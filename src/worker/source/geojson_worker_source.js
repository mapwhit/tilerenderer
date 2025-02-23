const rewind = require('@mapwhit/geojson-rewind');
const GeoJSONWrapper = require('../../source/geojson_wrapper');
const vtpbf = require('@mapwhit/vt-pbf');
const supercluster = require('supercluster');
const geojsonvt = require('geojson-vt');
const assert = require('assert');
const VectorTileWorkerSource = require('./vector_tile_worker_source');

function loadGeoJSONTile(params, callback) {
  const canonical = params.tileID.canonical;

  if (!this._geoJSONIndex) {
    return callback(null, null); // we couldn't load the file
  }

  const geoJSONTile = this._geoJSONIndex.getTile(canonical.z, canonical.x, canonical.y);
  if (!geoJSONTile) {
    return callback(null, null); // nothing in the given tile
  }

  const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);

  // Encode the geojson-vt tile into binary vector tile form.  This
  // is a convenience that allows `FeatureIndex` to operate the same way
  // across `VectorTileSource` and `GeoJSONSource` data.
  let pbf = vtpbf(geojsonWrapper);
  if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
    // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
    pbf = new Uint8Array(pbf);
  }

  callback(null, {
    vectorTile: geojsonWrapper,
    rawData: pbf.buffer
  });
}

// 'loadData' received while coalescing, trigger one more 'loadData' on receiving 'coalesced'

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
 * @private
 */
class GeoJSONWorkerSource extends VectorTileWorkerSource {
  /**
   * @param [loadGeoJSON] Optional method for custom loading/parsing of
   * GeoJSON based on parameters passed from the main-thread Source.
   * See {@link GeoJSONWorkerSource#loadGeoJSON}.
   */
  constructor(actor, layerIndex, loadGeoJSON) {
    super(actor, layerIndex, loadGeoJSONTile);
    if (loadGeoJSON) {
      this.loadGeoJSON = loadGeoJSON;
    }
  }

  /**
   * Fetches (if appropriate), parses, and index geojson data into tiles. This
   * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
   * can correctly serve up tiles.
   *
   * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
   * expecting `callback(error, data)` to be called with either an error or a
   * parsed GeoJSON object.
   *
   * When `loadData` requests come in faster than they can be processed,
   * they are coalesced into a single request using the latest data.
   * See {@link GeoJSONWorkerSource#coalesce}
   *
   * @param params
   * @param callback
   */
  loadData(params, callback) {
    if (this._pendingCallback) {
      // Tell the foreground the previous call has been abandoned
      this._pendingCallback(null, { abandoned: true });
    }
    this._pendingCallback = callback;
    this._pendingLoadDataParams = params;

    if (this._state && this._state !== 'Idle') {
      this._state = 'NeedsLoadData';
    } else {
      this._state = 'Coalescing';
      this._loadData();
    }
  }

  /**
   * Internal implementation: called directly by `loadData`
   * or by `coalesce` using stored parameters.
   */
  _loadData() {
    if (!this._pendingCallback || !this._pendingLoadDataParams) {
      assert(false);
      return;
    }
    const callback = this._pendingCallback;
    const params = this._pendingLoadDataParams;
    delete this._pendingCallback;
    delete this._pendingLoadDataParams;
    this.loadGeoJSON(params, (err, data) => {
      if (err || !data) {
        return callback(err);
      }
      if (typeof data !== 'object') {
        return callback(new Error('Input data is not a valid GeoJSON object.'));
      }
      rewind(data, true);

      try {
        this._geoJSONIndex = params.cluster
          ? supercluster(params.superclusterOptions).load(data.features)
          : geojsonvt(data, params.geojsonVtOptions);
      } catch (err) {
        return callback(err);
      }

      this.loaded = {};

      const result = {};
      callback(null, result);
    });
  }

  /**
   * While processing `loadData`, we coalesce all further
   * `loadData` messages into a single call to _loadData
   * that will happen once we've finished processing the
   * first message. {@link GeoJSONSource#_updateWorkerData}
   * is responsible for sending us the `coalesce` message
   * at the time it receives a response from `loadData`
   *
   *          State: Idle
   *          ↑          |
   *     'coalesce'   'loadData'
   *          |     (triggers load)
   *          |          ↓
   *        State: Coalescing
   *          ↑          |
   *   (triggers load)   |
   *     'coalesce'   'loadData'
   *          |          ↓
   *        State: NeedsLoadData
   */
  coalesce() {
    if (this._state === 'Coalescing') {
      this._state = 'Idle';
    } else if (this._state === 'NeedsLoadData') {
      this._state = 'Coalescing';
      this._loadData();
    }
  }

  /**
   * Implements {@link WorkerSource#reloadTile}.
   *
   * If the tile is loaded, uses the implementation in VectorTileWorkerSource.
   * Otherwise, such as after a setData() call, we load the tile fresh.
   *
   * @param params
   * @param params.uid The UID for this tile.
   */
  reloadTile(params, callback) {
    const loaded = this.loaded;
    const uid = params.uid;

    if (loaded?.[uid]) {
      return super.reloadTile(params, callback);
    }
    return this.loadTile(params, callback);
  }

  /**
   * Fetch and parse GeoJSON according to the given params.  Calls `callback`
   * with `(err, data)`, where `data` is a parsed GeoJSON object.
   *
   * GeoJSON is expected as a literal (string or object) `params.data`.
   *
   * @param params
   * @param [params.data] Literal GeoJSON data. Must be provided.
   */
  loadGeoJSON(params, callback) {
    if (typeof params.data === 'string') {
      try {
        return callback(null, JSON.parse(params.data));
      } catch (e) {
        return callback(new Error('Input data is not a valid GeoJSON object.'));
      }
    } else {
      return callback(new Error('Input data is not a valid GeoJSON object.'));
    }
  }

  removeSource(params, callback) {
    if (this._pendingCallback) {
      // Don't leak callbacks
      this._pendingCallback(null, { abandoned: true });
    }
    callback();
  }
}

module.exports = GeoJSONWorkerSource;
