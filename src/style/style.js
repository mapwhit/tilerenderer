const assert = require('assert');

const { Event, ErrorEvent, Evented } = require('../util/evented');
const createStyleLayer = require('./create_style_layer');
const loadSprite = require('./load_sprite');
const ImageManager = require('../render/image_manager');
const GlyphManager = require('../render/glyph_manager');
const Light = require('./light');
const LineAtlas = require('../render/line_atlas');
const { clone, deepEqual, filterObject, mapObject } = require('../util/object');
const browser = require('../util/browser');
const dispatcher = require('../util/dispatcher');
const { getType: getSourceType, setType: setSourceType } = require('../source/source');
const { queryRenderedFeatures, queryRenderedSymbols, querySourceFeatures } = require('../source/query_features');
const SourceCache = require('../source/source_cache');
const getWorkerPool = require('../util/global_worker_pool');
const deref = require('../style-spec/deref');
const { registerForPluginAvailability, evented: rtlTextPluginEvented } = require('../source/rtl_text_plugin');
const PauseablePlacement = require('./pauseable_placement');
const ZoomHistory = require('./zoom_history');
const CrossTileSymbolIndex = require('../symbol/cross_tile_symbol_index');

/**
 * @private
 */
class Style extends Evented {
  // exposed to allow stubbing by unit tests

  constructor(map, options = {}) {
    super();

    this.map = map;
    this.dispatcher = dispatcher(getWorkerPool(), this);
    this.imageManager = new ImageManager();
    this.glyphManager = new GlyphManager(options.localIdeographFontFamily);
    this.lineAtlas = new LineAtlas(256, 512);
    this.crossTileSymbolIndex = new CrossTileSymbolIndex();

    this._layers = {};
    this._order = [];
    this.sourceCaches = {};
    this.zoomHistory = new ZoomHistory();
    this._loaded = false;

    this._resetUpdates();

    const self = this;
    this._rtlTextPluginCallback = Style.registerForPluginAvailability(args => {
      self.dispatcher
        .broadcast('loadRTLTextPlugin', args.pluginURL)
        .then(_ => args.completionCallback(), args.completionCallback);
      for (const id in self.sourceCaches) {
        self.sourceCaches[id].reload(); // Should be a no-op if the plugin loads before any tiles load
      }
    });

    this.on('data', event => {
      if (event.dataType !== 'source' || event.sourceDataType !== 'metadata') {
        return;
      }

      const sourceCache = this.sourceCaches[event.sourceId];
      if (!sourceCache) {
        return;
      }

      const source = sourceCache.getSource();
      if (!source || !source.vectorLayerIds) {
        return;
      }

      for (const layerId in this._layers) {
        const layer = this._layers[layerId];
        if (layer.source === source.id) {
          this._validateLayer(layer);
        }
      }
    });
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

    const layers = deref(this.stylesheet.layers);

    this._order = layers.map(layer => layer.id);

    this._layers = {};
    for (let layer of layers) {
      layer = createStyleLayer(layer);
      layer.setEventedParent(this, { layer: { id: layer.id } });
      this._layers[layer.id] = layer;
    }

    this.dispatcher.broadcast('setLayers', this._serializeLayers(this._order));

    this.light = new Light(this.stylesheet.light);

    this.fire(new Event('data', { dataType: 'style' }));
    this.fire(new Event('style.load'));
  }

  _validateLayer(layer) {
    const sourceCache = this.sourceCaches[layer.source];
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

  loaded() {
    if (!this._loaded) return false;

    if (Object.keys(this._updatedSources).length) return false;

    for (const id in this.sourceCaches) if (!this.sourceCaches[id].loaded()) return false;

    if (!this.imageManager.isLoaded()) return false;

    return true;
  }

  _serializeLayers(ids) {
    return ids.map(id => this._layers[id].serialize());
  }

  hasTransitions() {
    if (this.light?.hasTransition()) {
      return true;
    }

    for (const id in this.sourceCaches) {
      if (this.sourceCaches[id].hasTransition()) {
        return true;
      }
    }

    for (const id in this._layers) {
      if (this._layers[id].hasTransition()) {
        return true;
      }
    }

    return false;
  }

  _checkLoaded() {
    if (!this._loaded) {
      throw new Error('Style is not done loading');
    }
  }

  /**
   * Apply queued style updates in a batch and recalculate zoom-dependent paint properties.
   */
  update(parameters) {
    if (!this._loaded) {
      return;
    }

    if (this._changed) {
      const updatedIds = Object.keys(this._updatedLayers);
      const removedIds = Object.keys(this._removedLayers);

      if (updatedIds.length || removedIds.length) {
        this._updateWorkerLayers(updatedIds, removedIds);
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
        this._layers[id].updateTransitions(parameters);
      }

      this.light.updateTransitions(parameters);

      this._resetUpdates();

      this.fire(new Event('data', { dataType: 'style' }));
    }

    for (const sourceId in this.sourceCaches) {
      this.sourceCaches[sourceId].used = false;
    }

    for (const layerId of this._order) {
      const layer = this._layers[layerId];

      layer.recalculate(parameters);
      if (!layer.isHidden(parameters.zoom) && layer.source) {
        this.sourceCaches[layer.source].used = true;
      }
    }

    this.light.recalculate(parameters);
    this.z = parameters.zoom;
  }

  _updateWorkerLayers(updatedIds, removedIds) {
    this.dispatcher.broadcast('updateLayers', {
      layers: this._serializeLayers(updatedIds),
      removedIds: removedIds
    });
  }

  _resetUpdates() {
    this._changed = false;

    this._updatedLayers = {};
    this._removedLayers = {};

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
    this._checkLoaded();

    return this.imageManager.listImages();
  }

  addSource(id, source) {
    this._checkLoaded();

    if (this.sourceCaches[id] !== undefined) {
      throw new Error('There is already a source with this ID');
    }

    if (!source.type) {
      throw new Error(
        `The type property must be defined, but the only the following properties were given: ${Object.keys(source).join(', ')}.`
      );
    }

    const sourceCache = (this.sourceCaches[id] = new SourceCache(id, source, this.dispatcher));
    sourceCache.style = this;
    sourceCache.setEventedParent(this, () => ({
      isSourceLoaded: this.loaded(),
      source: sourceCache.serialize(),
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
    this._checkLoaded();

    if (this.sourceCaches[id] === undefined) {
      throw new Error('There is no source with this ID');
    }
    for (const layerId in this._layers) {
      if (this._layers[layerId].source === id) {
        return this.fire(
          new ErrorEvent(new Error(`Source "${id}" cannot be removed while layer "${layerId}" is using it.`))
        );
      }
    }

    const sourceCache = this.sourceCaches[id];
    delete this.sourceCaches[id];
    delete this._updatedSources[id];
    sourceCache.fire(new Event('data', { sourceDataType: 'metadata', dataType: 'source', sourceId: id }));
    sourceCache.setEventedParent(null);
    sourceCache.clearTiles();

    if (sourceCache.onRemove) sourceCache.onRemove(this.map);
    this._changed = true;
  }

  /**
   * Set the data of a GeoJSON source, given its id.
   * @param {string} id id of the source
   * @param {GeoJSON|string} data GeoJSON source
   */
  setGeoJSONSourceData(id, data) {
    this._checkLoaded();

    assert(this.sourceCaches[id] !== undefined, 'There is no source with this ID');
    const geojsonSource = this.sourceCaches[id].getSource();
    assert(geojsonSource.type === 'geojson');

    geojsonSource.setData(data);
    this._changed = true;
  }

  /**
   * Get a source by id.
   * @param {string} id id of the desired source
   * @returns {Object} source
   */
  getSource(id) {
    return this.sourceCaches[id]?.getSource();
  }

  /**
   * Add a layer to the map style. The layer will be inserted before the layer with
   * ID `before`, or appended if `before` is omitted.
   * @param {string} [before] ID of an existing layer to insert before
   */
  addLayer(layerObject, before) {
    this._checkLoaded();

    const id = layerObject.id;

    if (this.getLayer(id)) {
      this.fire(new ErrorEvent(new Error(`Layer with id "${id}" already exists on this map`)));
      return;
    }

    if (typeof layerObject.source === 'object') {
      this.addSource(id, layerObject.source);
      layerObject = clone(layerObject);
      layerObject = Object.assign(layerObject, { source: id });
    }

    const layer = createStyleLayer(layerObject);
    this._validateLayer(layer);

    layer.setEventedParent(this, { layer: { id: id } });

    const index = before ? this._order.indexOf(before) : this._order.length;
    if (before && index === -1) {
      this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
      return;
    }

    this._order.splice(index, 0, id);
    this._layerOrderChanged = true;

    this._layers[id] = layer;

    if (this._removedLayers[id] && layer.source) {
      // If, in the current batch, we have already removed this layer
      // and we are now re-adding it with a different `type`, then we
      // need to clear (rather than just reload) the underyling source's
      // tiles.  Otherwise, tiles marked 'reloading' will have buckets /
      // buffers that are set up for the _previous_ version of this
      // layer, causing, e.g.:
      // https://github.com/mapbox/mapbox-gl-js/issues/3633
      const removed = this._removedLayers[id];
      delete this._removedLayers[id];
      if (removed.type !== layer.type) {
        this._updatedSources[layer.source] = 'clear';
      } else {
        this._updatedSources[layer.source] = 'reload';
        this.sourceCaches[layer.source].pause();
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
    this._checkLoaded();
    this._changed = true;

    const layer = this._layers[id];
    if (!layer) {
      this.fire(new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be moved.`)));
      return;
    }

    if (id === before) {
      return;
    }

    const index = this._order.indexOf(id);
    this._order.splice(index, 1);

    const newIndex = before ? this._order.indexOf(before) : this._order.length;
    if (before && newIndex === -1) {
      this.fire(new ErrorEvent(new Error(`Layer with id "${before}" does not exist on this map.`)));
      return;
    }
    this._order.splice(newIndex, 0, id);

    this._layerOrderChanged = true;
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
    this._checkLoaded();

    const layer = this._layers[id];
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be removed.`))
      );
      return;
    }

    layer.setEventedParent(null);

    const index = this._order.indexOf(id);
    this._order.splice(index, 1);

    this._layerOrderChanged = true;
    this._changed = true;
    this._removedLayers[id] = layer;
    delete this._layers[id];
    delete this._updatedLayers[id];
    delete this._updatedPaintProps[id];
  }

  /**
   * Return the style layer object with the given `id`.
   *
   * @param {string} id - id of the desired layer
   * @returns {?Object} a layer, if one with the given `id` exists
   */
  getLayer(id) {
    return this._layers[id];
  }

  setLayerZoomRange(layerId, minzoom, maxzoom) {
    this._checkLoaded();

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(
          new Error(`The layer '${layerId}' does not exist in the map's style and cannot have zoom extent.`)
        )
      );
      return;
    }

    if (layer.minzoom === minzoom && layer.maxzoom === maxzoom) return;

    if (minzoom != null) {
      layer.minzoom = minzoom;
    }
    if (maxzoom != null) {
      layer.maxzoom = maxzoom;
    }
    this._updateLayer(layer);
  }

  setFilter(layerId, filter) {
    this._checkLoaded();

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
      layer.filter = undefined;
      this._updateLayer(layer);
      return;
    }

    layer.filter = clone(filter);
    this._updateLayer(layer);
  }

  /**
   * Get a layer's filter object
   * @param {string} layer the layer to inspect
   * @returns {*} the layer's filter, if any
   */
  getFilter(layer) {
    return clone(this.getLayer(layer).filter);
  }

  setLayoutProperty(layerId, name, value) {
    this._checkLoaded();

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be styled.`))
      );
      return;
    }

    if (deepEqual(layer.getLayoutProperty(name), value)) return;

    layer.setLayoutProperty(name, value);
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
    this._checkLoaded();

    const layer = this.getLayer(layerId);
    if (!layer) {
      this.fire(
        new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be styled.`))
      );
      return;
    }

    if (deepEqual(layer.getPaintProperty(name), value)) return;

    const requiresRelayout = layer.setPaintProperty(name, value);
    if (requiresRelayout) {
      this._updateLayer(layer);
    }

    this._changed = true;
    this._updatedPaintProps[layerId] = true;
  }

  getPaintProperty(layer, name) {
    return this.getLayer(layer).getPaintProperty(name);
  }

  setFeatureState(feature, state) {
    this._checkLoaded();
    const sourceId = feature.source;
    const sourceLayer = feature.sourceLayer;
    const sourceCache = this.sourceCaches[sourceId];

    if (sourceCache === undefined) {
      this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
      return;
    }
    const sourceType = sourceCache.getSource().type;
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

  getFeatureState(feature) {
    this._checkLoaded();
    const sourceId = feature.source;
    const sourceLayer = feature.sourceLayer;
    const sourceCache = this.sourceCaches[sourceId];

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

  serialize() {
    return filterObject(
      {
        version: this.stylesheet.version,
        name: this.stylesheet.name,
        metadata: this.stylesheet.metadata,
        light: this.stylesheet.light,
        center: this.stylesheet.center,
        zoom: this.stylesheet.zoom,
        bearing: this.stylesheet.bearing,
        pitch: this.stylesheet.pitch,
        sprite: this.stylesheet.sprite,
        glyphs: this.stylesheet.glyphs,
        transition: this.stylesheet.transition,
        sources: mapObject(this.sourceCaches, source => source.serialize()),
        layers: this._order.map(id => this._layers[id].serialize())
      },
      value => value !== undefined
    );
  }

  _updateLayer(layer) {
    this._updatedLayers[layer.id] = true;
    if (layer.source && !this._updatedSources[layer.source]) {
      this._updatedSources[layer.source] = 'reload';
      this.sourceCaches[layer.source].pause();
    }
    this._changed = true;
  }

  _flattenAndSortRenderedFeatures(sourceResults) {
    const features = [];
    const features3D = [];
    for (let l = this._order.length - 1; l >= 0; l--) {
      const layerId = this._order[l];
      for (const sourceResult of sourceResults) {
        const layerFeatures = sourceResult[layerId];
        if (layerFeatures) {
          if (this._layers[layerId].type === 'fill-extrusion') {
            for (const featureWrapper of layerFeatures) {
              features3D.push(featureWrapper);
            }
          } else {
            for (const featureWrapper of layerFeatures) {
              features.push(featureWrapper.feature);
            }
          }
        }
      }
    }

    features3D.sort((a, b) => {
      return a.intersectionZ - b.intersectionZ;
    });

    for (const featureWrapper of features3D) {
      features.push(featureWrapper.feature);
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
        const layer = this._layers[layerId];
        if (layer) {
          includedSources[layer.source] = true;
        }
      }
    }

    const sourceResults = [];
    for (const id in this.sourceCaches) {
      if (params.layers && !includedSources[id]) continue;
      sourceResults.push(
        queryRenderedFeatures(this.sourceCaches[id], this._layers, queryGeometry.viewport, params, transform)
      );
    }

    if (this.placement) {
      // If a placement has run, query against its CollisionIndex
      // for symbol results, and treat it as an extra source to merge
      sourceResults.push(
        queryRenderedSymbols(
          this._layers,
          this.sourceCaches,
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
    const sourceCache = this.sourceCaches[sourceID];
    return sourceCache ? querySourceFeatures(sourceCache, params) : [];
  }

  getLight() {
    return this.light.getLight();
  }

  setLight(lightOptions) {
    this._checkLoaded();

    const light = this.light.getLight();
    let _update = false;
    for (const key in lightOptions) {
      if (!deepEqual(lightOptions[key], light[key])) {
        _update = true;
        break;
      }
    }
    if (!_update) return;

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

    this.light.setLight(lightOptions);
    this.light.updateTransitions(parameters);
  }

  _remove() {
    rtlTextPluginEvented.off('pluginAvailable', this._rtlTextPluginCallback);
    for (const id in this.sourceCaches) {
      this.sourceCaches[id].clearTiles();
    }
    this.dispatcher.remove();
  }

  _clearSource(id) {
    this.sourceCaches[id].clearTiles();
  }

  _reloadSource(id) {
    this.sourceCaches[id].resume();
    this.sourceCaches[id].reload();
  }

  _updateSources(transform) {
    for (const id in this.sourceCaches) {
      this.sourceCaches[id].update(transform);
    }
  }

  _generateCollisionBoxes() {
    for (const id in this.sourceCaches) {
      this._reloadSource(id);
    }
  }

  _updatePlacement(transform, showCollisionBoxes, fadeDuration, crossSourceCollisions) {
    let symbolBucketsChanged = false;
    let placementCommitted = false;

    const layerTiles = {};

    for (const layerID of this._order) {
      const styleLayer = this._layers[layerID];
      if (styleLayer.type !== 'symbol') continue;

      if (!layerTiles[styleLayer.source]) {
        const sourceCache = this.sourceCaches[styleLayer.source];
        layerTiles[styleLayer.source] = sourceCache
          .getRenderableIds(true)
          .map(id => sourceCache.getTileByID(id))
          .sort((a, b) => b.tileID.overscaledZ - a.tileID.overscaledZ || (a.tileID.isLessThan(b.tileID) ? -1 : 1));
      }

      const layerBucketsChanged = this.crossTileSymbolIndex.addLayer(
        styleLayer,
        layerTiles[styleLayer.source],
        transform.center.lng
      );
      symbolBucketsChanged = symbolBucketsChanged || layerBucketsChanged;
    }
    this.crossTileSymbolIndex.pruneUnusedLayers(this._order);

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
        this._order,
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
      this.pauseablePlacement.continuePlacement(this._order, this._layers, layerTiles);

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
      for (const layerID of this._order) {
        const styleLayer = this._layers[layerID];
        if (styleLayer.type !== 'symbol') continue;
        this.placement.updateLayerOpacities(styleLayer, layerTiles[styleLayer.source]);
      }
    }

    // needsRender is false when we have just finished a placement that didn't change the visibility of any symbols
    const needsRerender = !this.pauseablePlacement.isDone() || this.placement.hasTransitions(browser.now());
    return needsRerender;
  }

  _releaseSymbolFadeTiles() {
    for (const id in this.sourceCaches) {
      this.sourceCaches[id].releaseSymbolFadeTiles();
    }
  }

  // Callbacks from web workers

  getImages(_mapId, { icons }) {
    return this.imageManager.getImages(icons);
  }

  getGlyphs(_mapId, { stacks }) {
    return this.glyphManager.getGlyphs(stacks);
  }
}

Style.getSourceType = getSourceType;
Style.setSourceType = setSourceType;
Style.registerForPluginAvailability = registerForPluginAvailability;

module.exports = Style;
