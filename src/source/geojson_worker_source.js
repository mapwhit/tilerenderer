const rewind = require('@mapwhit/geojson-rewind');
const GeoJSONWrapper = require('./geojson_wrapper');
const vtpbf = require('@mapwhit/vt-pbf');
const supercluster = require('supercluster');
const geojsonvt = require('geojson-vt');
const VectorTileWorkerSource = require('./vector_tile_worker_source');

function loadGeoJSONTile(params) {
  if (!this._geoJSONIndex) {
    if (!this._createGeoJSONIndex) {
      return; // we couldn't load the file
    }

    try {
      this._geoJSONIndex = this._createGeoJSONIndex();
    } finally {
      this._createGeoJSONIndex = null;
    }
  }

  const { z, x, y } = params.tileID.canonical;
  const geoJSONTile = this._geoJSONIndex.getTile(z, x, y);
  if (!geoJSONTile) {
    return; // nothing in the given tile
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

  return {
    vectorTile: geojsonWrapper,
    rawData: pbf.buffer
  };
}

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.
 * For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
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
      this._geoJSONIndex = null;
      this._createGeoJSONIndex = params.cluster
        ? () => {
            rewind(data, true);
            return supercluster(params.superclusterOptions).load(data.features);
          }
        : () => {
            rewind(data, true);
            return geojsonvt(data, params.geojsonVtOptions);
          };

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
  reloadTile(params) {
    return this.loaded?.[params.uid] ? super.reloadTile(params) : this.loadTile(params);
  }

  /**
   * Fetch and parse GeoJSON according to the given params.
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
