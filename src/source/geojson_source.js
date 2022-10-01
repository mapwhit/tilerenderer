import { ErrorEvent, Event, Evented } from '@mapwhit/events';
import { createExpression } from '@mapwhit/style-expressions';
import EXTENT from '../data/extent.js';
import browser from '../util/browser.js';
import { applySourceDiff, isUpdateableGeoJSON, toUpdateable } from './geojson_source_diff.js';

/**
 * A source containing GeoJSON.
 * (See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-geojson) for detailed documentation of options.)
 *
 * @example
 * map.addSource('some id', {
 *     type: 'geojson',
 *     data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
 * });
 *
 * @example
 * map.addSource('some id', {
 *    type: 'geojson',
 *    data: {
 *        "type": "FeatureCollection",
 *        "features": [{
 *            "type": "Feature",
 *            "properties": {},
 *            "geometry": {
 *                "type": "Point",
 *                "coordinates": [
 *                    -76.53063297271729,
 *                    39.18174077994108
 *                ]
 *            }
 *        }]
 *    }
 * });
 *
 * @example
 * map.getSource('some id').setData({
 *   "type": "FeatureCollection",
 *   "features": [{
 *       "type": "Feature",
 *       "properties": { "name": "Null Island" },
 *       "geometry": {
 *           "type": "Point",
 *           "coordinates": [ 0, 0 ]
 *       }
 *   }]
 * });
 * @see [Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
 * @see [Add a GeoJSON line](https://www.mapbox.com/mapbox-gl-js/example/geojson-line/)
 * @see [Create a heatmap from points](https://www.mapbox.com/mapbox-gl-js/example/heatmap/)
 */
export default class GeoJSONSource extends Evented {
  #pendingDataEvents = new Set();
  #newData = false;
  #updateInProgress = false;
  #dataUpdateable;
  #tiler;

  constructor(id, options, eventedParent, tiler) {
    super();

    this.id = id;

    // `type` is a property rather than a constant to make it easy for 3rd
    // parties to use GeoJSONSource to build their own source types.
    this.type = 'geojson';

    this.minzoom = 0;
    this.maxzoom = 18;
    this.tileSize = 512;
    this.isTileClipped = true;
    this.reparseOverscaled = true;
    this._removed = false;

    this.setEventedParent(eventedParent);

    this.data = options.data;
    this._options = Object.assign({}, options);

    if (options.maxzoom !== undefined) {
      this.maxzoom = options.maxzoom;
    }
    if (options.type) {
      this.type = options.type;
    }
    this.promoteId = options.promoteId;

    const scale = EXTENT / this.tileSize;

    // sent to the worker, along with `url: ...` or `data: literal geojson`,
    // so that it can load/parse/index the geojson data
    // extending with `options.workerOptions` helps to make it easy for
    // third-party sources to hack/reuse GeoJSONSource.
    this.workerOptions = Object.assign(
      {
        source: this.id,
        cluster: options.cluster || false,
        geojsonVtOptions: {
          buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
          tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
          extent: EXTENT,
          maxZoom: this.maxzoom,
          lineMetrics: options.lineMetrics || false,
          generateId: options.generateId || false
        },
        superclusterOptions: {
          maxZoom:
            options.clusterMaxZoom !== undefined
              ? Math.min(options.clusterMaxZoom, this.maxzoom - 1)
              : this.maxzoom - 1,
          extent: EXTENT,
          radius: (options.clusterRadius || 50) * scale,
          log: false,
          generateId: options.generateId || false
        }
      },
      options.workerOptions
    );
    this.#tiler = tiler;
  }

  load() {
    this.#updateData('metadata');
  }

  onAdd(map) {
    this.map = map;
    this.load();
  }

  /**
   * Sets the GeoJSON data and re-renders the map.
   *
   * @param {Object|string} data A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON files.
   * @returns {GeoJSONSource} this
   */
  setData(data) {
    this.data = data;
    this.#dataUpdateable = undefined;
    this.#updateData();
    return this;
  }

  /**
   * Updates the source's GeoJSON, and re-renders the map.
   *
   * For sources with lots of features, this method can be used to make updates more quickly.
   *
   * This approach requires unique IDs for every feature in the source. The IDs can either be specified on the feature,
   * or by using the promoteId option to specify which property should be used as the ID.
   *
   * It is an error to call updateData on a source that did not have unique IDs for each of its features already.
   *
   * Updates are applied on a best-effort basis, updating an ID that does not exist will not result in an error.
   *
   * @param {GeoJSONSourceDiff} diff The changes that need to be applied.
   * @returns {GeoJSONSource} this
   */
  updateData(diff) {
    if (!this.#dataUpdateable) {
      throw new Error(`Cannot update existing geojson data in ${this.id}`);
    }
    applySourceDiff(this.#dataUpdateable, diff, this.promoteId);
    this.data = { type: 'FeatureCollection', features: Array.from(this.#dataUpdateable.values()) };
    this.#updateData();
    return this;
  }

  async #updateData(sourceDataType = 'content') {
    this.#newData = true;
    this.#pendingDataEvents.add(sourceDataType);
    if (this.#updateInProgress) {
      // will handle this update when the current one is done
      return;
    }
    try {
      this.#updateInProgress = true;
      this.fire(new Event('dataloading', { dataType: 'source' }));
      while (this.#newData) {
        this.#newData = false;
        await this.#updateTilerData();
      }
      this.#pendingDataEvents.forEach(sourceDataType =>
        this.fire(new Event('data', { dataType: 'source', sourceDataType }))
      );
      this.#pendingDataEvents.clear();
    } catch (err) {
      this.fire(new ErrorEvent(err));
    } finally {
      this.#updateInProgress = false;
    }
  }

  /*
   * Responsible for invoking tiler's `loadData` target, which
   * handles creating tiles, using geojson-vt or supercluster as appropriate.
   */
  async #updateTilerData() {
    this.data = await loadJSON(this.data, this.id);
    this.#dataUpdateable ??= updatableGeoJson(this.data, this.promoteId);
    this.data = filterGeoJSON(this.data, this._options);

    const options = { ...this.workerOptions, data: this.data };
    await this.#tiler.loadData(options);
    return this.data;
  }

  async loadTile(tile) {
    const params = {
      type: this.type,
      uid: tile.uid,
      tileID: tile.tileID,
      zoom: tile.tileID.overscaledZ,
      maxZoom: this.maxzoom,
      tileSize: this.tileSize,
      source: this.id,
      pixelRatio: browser.devicePixelRatio,
      showCollisionBoxes: this.map.showCollisionBoxes,
      justReloaded: tile.workerID != null,
      painter: this.map.painter,
      promoteId: this.promoteId
    };

    tile.workerID ??= true;
    const data = await this.#tiler.loadTile(params).finally(() => tile.unloadVectorData());
    if (!tile.aborted) {
      tile.loadVectorData(data, this.map.painter);
    }
  }

  abortTile(tile) {
    tile.aborted = true;
  }

  unloadTile(tile) {
    tile.unloadVectorData();
  }

  onRemove() {
    this._removed = true;
  }

  hasTransition() {
    return false;
  }
}

/**
 * Fetch and parse GeoJSON according to the given params.
 *
 * @param data Function loading GeoJSON dataor GeoJSON data directly. Must be provided.
 * GeoJSON can be either an object or string literal to be parsed.
 */
async function loadJSON(data, source) {
  if (typeof data === 'function') {
    data = await data().catch(() => {});
    if (!data) {
      throw new Error('no GeoJSON data');
    }
  }
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error(`Input data given to '${source}' is not a valid GeoJSON object.`);
    }
  }
  return data;
}

function filterGeoJSON(data, { filter }) {
  if (!filter) {
    return data;
  }
  const compiled = createExpression(filter, {
    type: 'boolean',
    'property-type': 'data-driven',
    overridable: false,
    transition: false
  });
  if (compiled.result === 'error') {
    throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
  }

  const features = data.features.filter(feature => compiled.value.evaluate({ zoom: 0 }, feature));
  return { type: 'FeatureCollection', features };
}

function updatableGeoJson(data, promoteId) {
  return isUpdateableGeoJSON(data, promoteId) ? toUpdateable(data, promoteId) : false;
}
