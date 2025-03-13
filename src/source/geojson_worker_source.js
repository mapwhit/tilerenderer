const rewind = require('@mapwhit/geojson-rewind');
const GeoJSONWrapper = require('./geojson_wrapper');
const vtpbf = require('@mapwhit/vt-pbf');
const supercluster = require('supercluster');
const geojsonvt = require('geojson-vt');
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
   * @param params
   * @param callback
   */
  loadData(params, callback) {
    try {
      const data = this.loadGeoJSON(params);
      rewind(data, true);
      this._geoJSONIndex = params.cluster
        ? supercluster(params.superclusterOptions).load(data.features)
        : geojsonvt(data, params.geojsonVtOptions);
      this.loaded = {};
      callback();
    } catch (err) {
      callback(err);
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
  loadGeoJSON(params) {
    try {
      return JSON.parse(params.data);
    } catch (e) {
      throw new Error('Input data is not a valid GeoJSON object.');
    }
  }

  removeSource(params, callback) {
    callback();
  }
}

module.exports = GeoJSONWorkerSource;
