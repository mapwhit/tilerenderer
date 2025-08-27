import rewind from '@mapwhit/geojson-rewind';
import geojsonvt from 'geojson-vt';
import Supercluster from 'supercluster';
import GeoJSONWrapper from './geojson_wrapper.js';
import makeWorkerTile from './worker_tile.js';

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 *
 */
class GeoJSONWorkerSource {
  constructor(resources, layerIndex) {
    this.resources = resources;
    this.layerIndex = layerIndex;
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
  loadData(params) {
    const data = loadJSON(params);
    this._geoJSONIndex = null;
    this._createGeoJSONIndex = params.cluster
      ? () => {
          rewind(data, true);
          return new Supercluster(params.superclusterOptions).load(data.features);
        }
      : () => {
          rewind(data, true);
          return geojsonvt(data, params.geojsonVtOptions);
        };
  }

  getTile(tileID) {
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
    const { z, x, y } = tileID.canonical;
    return this._geoJSONIndex.getTile(z, x, y);
  }

  /**
   * Implements {@link WorkerSource#loadTile}.
   */
  async loadTile(params) {
    const { tileID } = params;
    const geoJSONTile = this.getTile(tileID);
    if (!geoJSONTile) {
      return; // nothing in the given tile
    }
    const sourceLayer = new GeoJSONWrapper(geoJSONTile.features);
    const result = await makeWorkerTile(params, sourceLayer, this.layerIndex, this.resources);
    result.vectorTile = sourceLayer;
    return result;
  }
}

/**
 * Fetch and parse GeoJSON according to the given params.
 *
 * @param data Literal GeoJSON data. Must be provided.
 */
function loadJSON({ data, source }) {
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    throw new Error(`Input data given to '${source}' is not a valid GeoJSON object.`);
  }
}

export default GeoJSONWorkerSource;
