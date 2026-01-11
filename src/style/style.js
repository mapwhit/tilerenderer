import { ErrorEvent, Event, Evented } from '@mapwhit/events';
import assert from 'assert';
import GlyphManager from '../render/glyph_manager.js';
import ImageManager from '../render/image_manager.js';
import LineAtlas from '../render/line_atlas.js';
import { queryRenderedFeatures, queryRenderedSymbols, querySourceFeatures } from '../source/query_features.js';
import { resources } from '../source/resources/index.js';
import plugin from '../source/rtl_text_plugin.js';
import { getType as getSourceType, setType as setSourceType } from '../source/source.js';
import SourceCache from '../source/source_cache.js';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index.js';
import browser from '../util/browser.js';
import { deepEqual } from '../util/object.js';
import createStyleLayer from './create_style_layer.js';
import Light from './light.js';
import loadSprite from './load_sprite.js';
import PauseablePlacement from './pauseable_placement.js';
import StyleLayerIndex from './style_layer_index.js';
import ZoomHistory from './zoom_history.js';

const properties = [
  'version',
  'name',
  'metadata',
  'center',
  'zoom',
  'bearing',
  'pitch',
  'state',
  'sprite',
  'glyphs',
  'transition'
];

/**
 * @private
 */
class Style extends Evented {
  #resources = resources({
    getImages: this.getImages.bind(this),
    loadGlyphRange: this.loadGlyphRange.bind(this)
  });
  #layerIndex = new StyleLayerIndex();
  #opsQueue = [];

  constructor(map, options = {}) {
    super();

    this.map = map;
    this.imageManager = new ImageManager();
    this.glyphManager = new GlyphManager();

    this.lineAtlas = new LineAtlas(256, 512);
    this.crossTileSymbolIndex = new CrossTileSymbolIndex();

    // insertion operations are done in the order of the layers in the style
    this._layers = new Map();
    this._sources = {};
    this.zoomHistory = new ZoomHistory();
    this._loaded = false;
    this._globalState = {};

    this._updatedLayers = new Map();
    this._removedLayers = new Map();
    this._resetUpdates();

    this._rtlTextPluginCallbackUnregister = plugin.registerForPluginAvailability(this._reloadSources.bind(this));

    this.on('data', event => {
      if (event.dataType !== 'source' || event.sourceDataType !== 'metadata') {
        return;
      }

      const sourceCache = this._sources[event.sourceId];
      if (!sourceCache) {
        return;
      }

      const source = sourceCache.getSource();
      if (!source || !source.vectorLayerIds) {
        return;
      }

      for (const layer of this._layers.values()) {
        if (layer.source === source.id) {
          this._validateLayer(layer);
        }
      }
    });
  }

  setGlobalStateProperty(name, value) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setGlobalStateProperty(name, value));
      return;
    }

    const newValue = value === null ? (this.stylesheet.state?.[name]?.default ?? null) : value;

    if (deepEqual(newValue, this._globalState[name])) {
      return this;
    }

    this._globalState[name] = newValue;

    this._applyGlobalStateChanges([name]);
  }

  getGlobalState() {
    return this._globalState;
  }

  setGlobalState(newStylesheetState) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setGlobalState(newStylesheetState));
      return;
    }

    const changedGlobalStateRefs = [];

    for (const propertyName in newStylesheetState) {
      const didChange = !deepEqual(this._globalState[propertyName], newStylesheetState[propertyName].default);

      if (didChange) {
        changedGlobalStateRefs.push(propertyName);
        this._globalState[propertyName] = newStylesheetState[propertyName].default;
      }
    }

    this._applyGlobalStateChanges(changedGlobalStateRefs);
  }

  /**
   *  * Find all sources that are affected by the global state changes and reload them.
   * Find all paint properties that are affected by the global state changes and update them.
   * For example, if a layer filter uses global-state expression, this function will find the source id of that layer.
   */
  _applyGlobalStateChanges(globalStateRefs) {
    if (globalStateRefs.length === 0) {
      return;
    }

    const sourceIdsToReload = new Set();

    for (const layer of this._layers.values()) {
      const layoutAffectingGlobalStateRefs = layer.getLayoutAffectingGlobalStateRefs();
      const paintAffectingGlobalStateRefs = layer.getPaintAffectingGlobalStateRefs();
      const visibilityAffectingGlobalStateRefs = layer.getVisibilityAffectingGlobalStateRefs();
      let visibilityToEval;

      for (const ref of globalStateRefs) {
        if (layoutAffectingGlobalStateRefs.has(ref)) {
          sourceIdsToReload.add(layer.source);
        }
        if (paintAffectingGlobalStateRefs.has(ref)) {
          for (const { name, value } of paintAffectingGlobalStateRefs.get(ref)) {
            this._updatePaintProperty(layer, name, value);
          }
        }
        if (visibilityAffectingGlobalStateRefs?.has(ref)) {
          visibilityToEval = true;
        }
      }
      if (visibilityToEval) {
        layer.recalculateVisibility();
        this._updateLayer(layer);
      }
    }

    for (const id in this._sources) {
      if (sourceIdsToReload.has(id)) {
        this._reloadSource(id);
        this._changed = true;
      }
    }
  }

  loadJSON(json) {
    this.fire(new Event('dataloading', { dataType: 'style' }));

    browser.frame(() => {
      this._load(json);
    });
  }

  _load(json) {
    this._loaded = true;
    this.stylesheet = json;
    properties.forEach(prop => (this[prop] = json[prop]));

    this.sources = {};
    for (const id in json.sources) {
      this.addSource(id, json.sources[id]);
    }

    if (json.sprite) {
      loadSprite(json.sprite)
        .then(images => {
          if (images) {
            for (const id in images) {
              this.imageManager.addImage(id, images[id]);
            }
          }

          this.imageManager.setLoaded();
          this.fire(new Event('data', { dataType: 'style' }));
        })
        .catch(err => this.fire(new ErrorEvent(err)));
    } else {
      this.imageManager.setLoaded();
    }

    this.glyphManager.setGlyphsLoader(json.glyphs);

    const layers = this.stylesheet.layers;

    this._layers.clear();

    this.setGlobalState(this.stylesheet.state ?? null);

    for (let layer of layers) {
      if (layer.ref) {
        continue; // just ignore layers that reference other layers
      }
      layer = createStyleLayer(layer, this._globalState);
      layer.setEventedParent(this, { layer: { id: layer.id } });
      this._layers.set(layer.id, layer);
    }

    this.#layerIndex.replace(this._layers);

    this.light = this.stylesheet.light;
    this._light = new Light(this.light);

    this.#opsQueue.forEach(op => op());
    this.#opsQueue = [];

    this.fire(new Event('data', { dataType: 'style' }));
    this.fire(new Event('style.load'));
  }

  _validateLayer(layer) {
    const sourceCache = this._sources[layer.source];
    if (!sourceCache) {
      return;
    }

    const sourceLayer = layer.sourceLayer;
    if (!sourceLayer) {
      return;
    }

    const source = sourceCache.getSource();
    if (source.type === 'geojson' || (source.vectorLayerIds && source.vectorLayerIds.indexOf(sourceLayer) === -1)) {
      this.fire(
        new ErrorEvent(
          new Error(
            `Source layer "${sourceLayer}" ` +
              `does not exist on source "${source.id}" ` +
              `as specified by style layer "${layer.id}"`
          )
        )
      );
    }
  }

  /**
   * Returns `true` when style is loaded.
   * @param {Boolean} ignoreTilesLoading set to `true` to check that style is loaded
   * even when sources are loading tiles
   */
  loaded(ignoreTilesLoading) {
    if (!this._loaded) {
      return false;
    }

    if (Object.keys(this._updatedSources).length) {
      return false;
    }

    for (const id in this._sources) {
      if (!this._sources[id].loaded(ignoreTilesLoading)) {
        return false;
      }
    }

    if (!this.imageManager.isLoaded()) {
      return false;
    }

    return true;
  }

  hasTransitions() {
    if (this._light?.hasTransition()) {
      return true;
    }

    for (const id in this._sources) {
      if (this._sources[id].hasTransition()) {
        return true;
      }
    }

    for (const layer of this._layers.values()) {
      if (layer.hasTransition()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply queued style updates in a batch and recalculate zoom-dependent paint properties.
   */
  update(parameters) {
    if (!this._loaded) {
      return;
    }

    if (this._changed) {
      if (this._updatedLayers.size || this._removedLayers.size) {
        this._updateWorkerLayers();
      }
      for (const id in this._updatedSources) {
        const action = this._updatedSources[id];
        assert(action === 'reload' || action === 'clear');
        if (action === 'reload') {
          this._reloadSource(id);
        } else if (action === 'clear') {
          this._clearSource(id);
        }
      }

      for (const id in this._updatedPaintProps) {
        this._layers.get(id).updateTransitions(parameters);
      }

      this._light.updateTransitions(parameters);

      this._resetUpdates();

      this.fire(new Event('data', { dataType: 'style' }));
    }

    for (const sourceId in this._sources) {
      this._sources[sourceId].used = false;
    }

    for (const layer of this._layers.values()) {
      layer.recalculate(parameters);
      if (!layer.isHidden(parameters.zoom) && layer.source) {
        this._sources[layer.source].used = true;
      }
    }

    this._light.recalculate(parameters);
    this.z = parameters.zoom;
  }

  _updateWorkerLayers() {
    this.#layerIndex.update();
  }

  _resetUpdates() {
    this._changed = false;

    this._updatedLayers.clear();
    this._removedLayers.clear();

    this._updatedSources = {};
    this._updatedPaintProps = {};
  }

  addImage(id, image) {
    if (this.getImage(id)) {
      return this.fire(new ErrorEvent(new Error('An image with this name already exists.')));
    }
    this.imageManager.addImage(id, image);
    this.fire(new Event('data', { dataType: 'style' }));
  }

  getImage(id) {
    return this.imageManager.getImage(id);
  }

  removeImage(id) {
    if (!this.getImage(id)) {
      return this.fire(new ErrorEvent(new Error('No image with this name exists.')));
    }
    this.imageManager.removeImage(id);
    this.fire(new Event('data', { dataType: 'style' }));
  }

  listImages() {
    if (!this._loaded) {
      return;
    }

    return this.imageManager.listImages();
  }

  addSource(id, source) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.addSource(id, source));
      return;
    }

    if (this._sources[id] !== undefined) {
      throw new Error('There is already a source with this ID');
    }

    if (!source.type) {
      throw new Error(
        `The type property must be defined, but the only the following properties were given: ${Object.keys(source).join(', ')}.`
      );
    }

    this.sources[id] = source;

    const sourceCache = (this._sources[id] = new SourceCache(id, source, {
      resources: this.#resources,
      layerIndex: this.#layerIndex,
      showTileBoundaries: this.map.showTileBoundaries
    }));
    sourceCache.style = this;
    sourceCache.setEventedParent(this, () => ({
      isSourceLoaded: this.loaded(),
      source: sourceCache,
      sourceId: id
    }));

    sourceCache.onAdd(this.map);
    this._changed = true;
  }

  /**
   * Remove a source from this stylesheet, given its id.
   * @param {string} id id of the source to remove
   * @throws {Error} if no source is found with the given ID
   */
  removeSource(id) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.removeSource(id));
      return;
    }

    if (this._sources[id] === undefined) {
      throw new Error('There is no source with this ID');
    }
    for (const [layerId, layer] of this._layers) {
      if (layer.source === id) {
        return this.fire(
          new ErrorEvent(new Error(`Source "${id}" cannot be removed while layer "${layerId}" is using it.`))
        );
      }
    }

    const sourceCache = this._sources[id];
    delete this._sources[id];
    delete this._updatedSources[id];
    sourceCache.fire(new Event('data', { sourceDataType: 'metadata', dataType: 'source', sourceId: id }));
    sourceCache.setEventedParent(null);
    sourceCache.clearTiles();

    if (sourceCache.onRemove) {
      sourceCache.onRemove(this.map);
    }
    this._changed = true;
  }

  /**
   * Set the data of a GeoJSON source, given its id.
   * @param {string} id id of the source
   * @param {GeoJSON|string} data GeoJSON source
   */
  setGeoJSONSourceData(id, data) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setGeoJSONSourceData(id, data));
      return;
    }

    assert(this._sources[id] !== undefined, 'There is no source with this ID');
    const geojsonSource = this._sources[id].getSource();
    assert(geojsonSource.type === 'geojson');

    this.sources[id].data = data;
    geojsonSource.setData(data);
    this._changed = true;
  }

  /**
   * Get a source by id.
   * @param {string} id id of the desired source
   * @returns {Object} source
   */
  getSource(id) {
    return this._sources[id]?.getSource();
  }

  _insertLayer(id, layer, before, move) {
    if (!before) {
      if (move) {
        this._layers.delete(id);
      }
      this._layers.set(id, layer);
      this._layerOrderChanged = true;
      return;
    }
    let beforeFound;
    const _layers = new Map();
    for (const [key, value] of this._layers.entries()) {
      if (key === before) {
        _layers.set(id, layer);
        beforeFound = true;
      }
      if (move && key === id) {
        continue;
      }
      _layers.set(key, value);
    }
    if (!beforeFound) {
      this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
      return;
    }
    this._layers = _layers;
    this._layerOrderChanged = true;
  }

  /**
   * Add a layer to the map style. The layer will be inserted before the layer with
   * ID `before`, or appended if `before` is omitted.
   * @param {string} [before] ID of an existing layer to insert before
   */
  addLayer(layerObject, before) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.addLayer(layerObject, before));
      return;
    }

    const id = layerObject.id;

    if (this.getLayer(id)) {
      this.fire(new ErrorEvent(new Error(`Layer with id "${id}" already exists on this map`)));
      return;
    }

    if (typeof layerObject.source === 'object') {
      this.addSource(id, layerObject.source);
      layerObject = structuredClone(layerObject);
      layerObject = Object.assign(layerObject, { source: id });
    }

    const layer = createStyleLayer(layerObject, this._globalState);
    this._validateLayer(layer);

    layer.setEventedParent(this, { layer: { id: id } });

    this._insertLayer(id, layer, before);

    if (this._removedLayers.has(id) && layer.source) {
      // If, in the current batch, we have already removed this layer
      // and we are now re-adding it with a different `type`, then we
      // need to clear (rather than just reload) the underyling source's
      // tiles.  Otherwise, tiles marked 'reloading' will have buckets /
      // buffers that are set up for the _previous_ version of this
      // layer, causing, e.g.:
      // https://github.com/mapbox/mapbox-gl-js/issues/3633
      const removed = this._removedLayers.get(id);
      this._removedLayers.delete(id);
      if (removed.type !== layer.type) {
        this._updatedSources[layer.source] = 'clear';
      } else {
        this._updatedSources[layer.source] = 'reload';
        this._sources[layer.source].pause();
      }
    }
    this._updateLayer(layer);
  }

  /**
   * Moves a layer to a different z-position. The layer will be inserted before the layer with
   * ID `before`, or appended if `before` is omitted.
   * @param {string} id  ID of the layer to move
   * @param {string} [before] ID of an existing layer to insert before
   */
  moveLayer(id, before) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.moveLayer(id, before));
      return;
    }
    this._changed = true;

    const layer = this._layers.get(id);
    if (!layer) {
      this.fire(new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be moved.`)));
      return;
    }

    if (id === before) {
      return;
    }

    this._insertLayer(id, layer, before, true);
  }

  /**
   * Remove the layer with the given id from the style.
   *
   * If no such layer exists, an `error` event is fired.
   *
   * @param {string} id id of the layer to remove
   * @fires error
   */
  removeLayer(id) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.removeLayer(id));
      return;
    }

    const layer = this._layers.get(id);
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be removed.`))
      );
      return;
    }

    layer.setEventedParent(null);

    this._layerOrderChanged = true;
    this._changed = true;
    this._removedLayers.set(id, layer);
    this._layers.delete(id);
    this._updatedLayers.delete(id);
    delete this._updatedPaintProps[id];
  }

  /**
   * Return the style layer object with the given `id`.
   *
   * @param {string} id - id of the desired layer
   * @returns {?Object} a layer, if one with the given `id` exists
   */
  getLayer(id) {
    return this._layers.get(id);
  }

  setLayerZoomRange(layerId, minzoom, maxzoom) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setLayerZoomRange(layerId, minzoom, maxzoom));
      return;
    }

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(
          new Error(`The layer '${layerId}' does not exist in the map's style and cannot have zoom extent.`)
        )
      );
      return;
    }

    if (layer._setZoomRange(minzoom, maxzoom)) {
      this._updateLayer(layer);
    }
  }

  get layers() {
    return Array.from(this._layers.values());
  }

  setFilter(layerId, filter) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setFilter(layerId, filter));
      return;
    }

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be filtered.`))
      );
      return;
    }

    if (deepEqual(layer.filter, filter)) {
      return;
    }

    if (filter === null || filter === undefined) {
      layer.setFilter(undefined);
      this._updateLayer(layer);
      return;
    }

    layer.setFilter(structuredClone(filter));
    this._updateLayer(layer);
  }

  /**
   * Get a layer's filter object
   * @param {string} layer the layer to inspect
   * @returns {*} the layer's filter, if any
   */
  getFilter(layer) {
    return structuredClone(this.getLayer(layer).filter);
  }

  setLayoutProperty(layerId, name, value) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setLayoutProperty(layerId, name, value));
      return;
    }

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be styled.`))
      );
      return;
    }

    if (deepEqual(layer.getLayoutProperty(name), value)) {
      return;
    }

    layer.setLayoutProperty(name, value);
    const layerObject = this.layers.find(({ id }) => id === layerId);
    layerObject.layout ??= {};
    layerObject.layout[name] = value;

    this._updateLayer(layer);
  }

  /**
   * Get a layout property's value from a given layer
   * @param {string} layer the layer to inspect
   * @param {string} name the name of the layout property
   * @returns {*} the property value
   */
  getLayoutProperty(layer, name) {
    return this.getLayer(layer).getLayoutProperty(name);
  }

  setPaintProperty(layerId, name, value) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setPaintProperty(layerId, name, value));
      return;
    }

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be styled.`))
      );
      return;
    }

    if (deepEqual(layer.getPaintProperty(name), value)) {
      return;
    }

    const layerObject = this.layers.find(({ id }) => id === layerId);
    layerObject.paint ??= {};
    layerObject.paint[name] = value;

    this._updatePaintProperty(layer, name, value);
  }

  _updatePaintProperty(layer, name, value) {
    const requiresRelayout = layer.setPaintProperty(name, value);
    if (requiresRelayout) {
      this._updateLayer(layer);
    }

    this._changed = true;
    this._updatedPaintProps[layer.id] = true;
  }

  getPaintProperty(layer, name) {
    return this.getLayer(layer).getPaintProperty(name);
  }

  setFeatureState(feature, state) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setFeatureState(feature, state));
      return;
    }
    const sourceId = feature.source;
    const sourceLayer = feature.sourceLayer;
    const sourceCache = this._sources[sourceId];

    if (sourceCache === undefined) {
      this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
      return;
    }
    const sourceType = sourceCache.getSource().type;
    if (sourceType === 'geojson' && sourceLayer) {
      this.fire(new ErrorEvent(new Error('GeoJSON sources cannot have a sourceLayer parameter.')));
      return;
    }
    if (sourceType === 'vector' && !sourceLayer) {
      this.fire(new ErrorEvent(new Error('The sourceLayer parameter must be provided for vector source types.')));
      return;
    }
    if (feature.id == null || feature.id === '') {
      this.fire(new ErrorEvent(new Error('The feature id parameter must be provided.')));
      return;
    }

    sourceCache.setFeatureState(sourceLayer, feature.id, state);
  }

  removeFeatureState(target, key) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.removeFeatureState(target, key));
      return;
    }
    const sourceId = target.source;
    const sourceCache = this._sources[sourceId];

    if (sourceCache === undefined) {
      this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
      return;
    }

    const sourceType = sourceCache.getSource().type;
    const sourceLayer = sourceType === 'vector' ? target.sourceLayer : undefined;

    if (sourceType === 'vector' && !sourceLayer) {
      this.fire(new ErrorEvent(new Error('The sourceLayer parameter must be provided for vector source types.')));
      return;
    }

    if (key && typeof target.id !== 'string' && typeof target.id !== 'number') {
      this.fire(new ErrorEvent(new Error('A feature id is required to remove its specific state property.')));
      return;
    }

    sourceCache.removeFeatureState(sourceLayer, target.id, key);
  }

  getFeatureState(feature) {
    if (!this._loaded) {
      return;
    }
    const sourceId = feature.source;
    const sourceLayer = feature.sourceLayer;
    const sourceCache = this._sources[sourceId];

    if (sourceCache === undefined) {
      this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
      return;
    }
    const sourceType = sourceCache.getSource().type;
    if (sourceType === 'vector' && !sourceLayer) {
      this.fire(new ErrorEvent(new Error('The sourceLayer parameter must be provided for vector source types.')));
      return;
    }

    return sourceCache.getFeatureState(sourceLayer, feature.id);
  }

  getTransition() {
    return Object.assign({ duration: 300, delay: 0 }, this.stylesheet?.transition);
  }

  _updateLayer(layer) {
    this._updatedLayers.set(layer.id, layer);
    if (layer.source && !this._updatedSources[layer.source]) {
      this._updatedSources[layer.source] = 'reload';
      this._sources[layer.source].pause();
    }
    this._changed = true;
  }

  _flattenAndSortRenderedFeatures(sourceResults) {
    // Feature order is complicated.
    // The order between features in two 2D layers is always determined by layer order.
    // The order between features in two 3D layers is always determined by depth.
    // The order between a feature in a 2D layer and a 3D layer is tricky:
    //      Most often layer order determines the feature order in this case. If
    //      a line layer is above a extrusion layer the line feature will be rendered
    //      above the extrusion. If the line layer is below the extrusion layer,
    //      it will be rendered below it.
    //
    //      There is a weird case though.
    //      You have layers in this order: extrusion_layer_a, line_layer, extrusion_layer_b
    //      Each layer has a feature that overlaps the other features.
    //      The feature in extrusion_layer_a is closer than the feature in extrusion_layer_b so it is rendered above.
    //      The feature in line_layer is rendered above extrusion_layer_a.
    //      This means that that the line_layer feature is above the extrusion_layer_b feature despite
    //      it being in an earlier layer.

    const isLayer3D = layer => layer.type === 'fill-extrusion';

    const layerIndex = new Map();
    const features3D = [];
    const layers = Array.from(this._layers.values());
    for (let l = layers.length - 1; l >= 0; l--) {
      const layer = layers[l];
      if (isLayer3D(layer)) {
        layerIndex.set(layer.id, l);
        for (const sourceResult of sourceResults) {
          const layerFeatures = sourceResult[layer.id];
          if (layerFeatures) {
            for (const featureWrapper of layerFeatures) {
              features3D.push(featureWrapper);
            }
          }
        }
      }
    }

    features3D.sort((a, b) => {
      return b.intersectionZ - a.intersectionZ;
    });

    const features = [];
    for (let l = layers.length - 1; l >= 0; l--) {
      const layer = layers[l];

      if (isLayer3D(layer)) {
        // add all 3D features that are in or above the current layer
        for (let i = features3D.length - 1; i >= 0; i--) {
          const topmost3D = features3D[i].feature;
          if (layerIndex.get(topmost3D.layer.id) < l) {
            break;
          }
          features.push(topmost3D);
          features3D.pop();
        }
      } else {
        for (const sourceResult of sourceResults) {
          const layerFeatures = sourceResult[layer.id];
          if (layerFeatures) {
            for (const featureWrapper of layerFeatures) {
              features.push(featureWrapper.feature);
            }
          }
        }
      }
    }

    return features;
  }

  queryRenderedFeatures(queryGeometry, params, transform) {
    const includedSources = {};
    if (params?.layers) {
      if (!Array.isArray(params.layers)) {
        this.fire(new ErrorEvent(new Error('parameters.layers must be an Array.')));
        return [];
      }
      for (const layerId of params.layers) {
        const layer = this._layers.get(layerId);
        if (layer) {
          includedSources[layer.source] = true;
        }
      }
    }

    const sourceResults = [];
    params = params ? { ...params, globalState: this._globalState } : { globalState: this._globalState };
    for (const id in this._sources) {
      if (params?.layers && !includedSources[id]) {
        continue;
      }
      sourceResults.push(
        queryRenderedFeatures(this._sources[id], this._layers, queryGeometry.viewport, params, transform)
      );
    }

    if (this.placement) {
      // If a placement has run, query against its CollisionIndex
      // for symbol results, and treat it as an extra source to merge
      sourceResults.push(
        queryRenderedSymbols(
          this._layers,
          this._sources,
          queryGeometry.viewport,
          params,
          this.placement.collisionIndex,
          this.placement.retainedQueryData
        )
      );
    }
    return this._flattenAndSortRenderedFeatures(sourceResults);
  }

  querySourceFeatures(sourceID, params) {
    const sourceCache = this._sources[sourceID];
    return sourceCache
      ? querySourceFeatures(
          sourceCache,
          params ? { ...params, globalState: this._globalState } : { globalState: this._globalState }
        )
      : [];
  }

  getLight() {
    return this._light.getLight();
  }

  setLight(lightOptions) {
    if (!this._loaded) {
      this.#opsQueue.push(() => this.setLight(lightOptions));
      return;
    }

    const light = this._light.getLight();
    let _update = false;
    for (const key in lightOptions) {
      if (!deepEqual(lightOptions[key], light[key])) {
        _update = true;
        break;
      }
    }
    if (!_update) {
      return;
    }

    const parameters = {
      now: browser.now(),
      transition: Object.assign(
        {
          duration: 300,
          delay: 0
        },
        this.stylesheet.transition
      )
    };

    this._light.setLight(lightOptions);
    this._light.updateTransitions(parameters);
  }

  _remove() {
    this._rtlTextPluginCallbackUnregister?.();
    for (const id in this._sources) {
      this._sources[id].clearTiles();
    }
  }

  _clearSource(id) {
    this._sources[id].clearTiles();
  }

  _reloadSource(id) {
    this._sources[id].resume();
    this._sources[id].reload();
  }

  _updateSources(transform) {
    for (const id in this._sources) {
      this._sources[id].update(transform);
    }
  }

  _reloadSources() {
    for (const sourceCache of Object.values(this._sources)) {
      sourceCache.reload(); // Should be a no-op if called before any tiles load
    }
  }

  _generateCollisionBoxes() {
    for (const id in this._sources) {
      this._reloadSource(id);
    }
  }

  _updatePlacement(transform, showCollisionBoxes, fadeDuration, crossSourceCollisions) {
    let symbolBucketsChanged = false;
    let placementCommitted = false;

    const layerTiles = {};

    for (const layer of this._layers.values()) {
      if (layer.type !== 'symbol') {
        continue;
      }

      if (!layerTiles[layer.source]) {
        const sourceCache = this._sources[layer.source];
        layerTiles[layer.source] = sourceCache
          .getRenderableIds(true)
          .map(id => sourceCache.getTileByID(id))
          .sort((a, b) => b.tileID.overscaledZ - a.tileID.overscaledZ || (a.tileID.isLessThan(b.tileID) ? -1 : 1));
      }

      const layerBucketsChanged = this.crossTileSymbolIndex.addLayer(
        layer,
        layerTiles[layer.source],
        transform.center.lng
      );
      symbolBucketsChanged = symbolBucketsChanged || layerBucketsChanged;
    }
    this.crossTileSymbolIndex.pruneUnusedLayers(this._layers.keys());

    // Anything that changes our "in progress" layer and tile indices requires us
    // to start over. When we start over, we do a full placement instead of incremental
    // to prevent starvation.
    // We need to restart placement to keep layer indices in sync.
    const forceFullPlacement = this._layerOrderChanged;

    if (
      forceFullPlacement ||
      !this.pauseablePlacement ||
      (this.pauseablePlacement.isDone() && !this.placement.stillRecent(browser.now()))
    ) {
      this.pauseablePlacement = new PauseablePlacement(
        transform,
        this._layers.size - 1,
        forceFullPlacement,
        showCollisionBoxes,
        fadeDuration,
        crossSourceCollisions
      );
      this._layerOrderChanged = false;
    }

    if (this.pauseablePlacement.isDone()) {
      // the last placement finished running, but the next one hasn’t
      // started yet because of the `stillRecent` check immediately
      // above, so mark it stale to ensure that we request another
      // render frame
      this.placement.setStale();
    } else {
      this.pauseablePlacement.continuePlacement(Array.from(this._layers.values()), layerTiles);

      if (this.pauseablePlacement.isDone()) {
        this.placement = this.pauseablePlacement.commit(this.placement, browser.now());
        placementCommitted = true;
      }

      if (symbolBucketsChanged) {
        // since the placement gets split over multiple frames it is possible
        // these buckets were processed before they were changed and so the
        // placement is already stale while it is in progress
        this.pauseablePlacement.placement.setStale();
      }
    }

    if (placementCommitted || symbolBucketsChanged) {
      for (const layer of this._layers.values()) {
        if (layer.type !== 'symbol') {
          continue;
        }
        this.placement.updateLayerOpacities(layer, layerTiles[layer.source]);
      }
    }

    // needsRender is false when we have just finished a placement that didn't change the visibility of any symbols
    const needsRerender = !this.pauseablePlacement.isDone() || this.placement.hasTransitions(browser.now());
    return needsRerender;
  }

  _releaseSymbolFadeTiles() {
    for (const id in this._sources) {
      this._sources[id].releaseSymbolFadeTiles();
    }
  }

  // Callbacks from web workers
  getImages({ icons }) {
    return this.imageManager.getImages(icons);
  }

  loadGlyphRange({ stack, range }) {
    return this.glyphManager.loadGlyphRange(stack, range);
  }
}

Style.getSourceType = getSourceType;
Style.setSourceType = setSourceType;

export default Style;
