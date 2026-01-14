import rewind from '@mapwhit/geojson-rewind';
import geojsonvt from 'geojson-vt';
import Supercluster from 'supercluster';
import GeoJSONWrapper from './geojson_wrapper.js';
import { makeSingleSourceLayerWorkerTile as makeWorkerTile } from './worker_tile.js';

/**
 * Creates tiles from GeoJSON data.
 */
export default function makeTiler(resources, layerIndex) {
  let geoJSONIndex;
  let createGeoJSONIndex;

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
   */
  function loadData(params) {
    const { cluster, data, geojsonVtOptions, superclusterOptions } = params;
    geoJSONIndex = undefined;
    createGeoJSONIndex = cluster
      ? () => {
          rewind(data, true);
          return new Supercluster(superclusterOptions).load(data.features);
        }
      : () => {
          rewind(data, true);
          return geojsonvt(data, geojsonVtOptions);
        };
  }

  function getTile(tileID) {
    if (!geoJSONIndex) {
      if (!createGeoJSONIndex) {
        return; // we couldn't load the file
      }

      try {
        geoJSONIndex = createGeoJSONIndex();
      } finally {
        createGeoJSONIndex = undefined;
      }
    }
    const { z, x, y } = tileID.canonical;
    return geoJSONIndex.getTile(z, x, y);
  }

  /**
   * Returns a single tile.
   */
  async function loadTile(params) {
    const { tileID, source } = params;
    const geoJSONTile = getTile(tileID);
    if (!geoJSONTile) {
      return; // nothing in the given tile
    }
    const sourceLayer = new GeoJSONWrapper(geoJSONTile.features);
    const layerFamilies = layerIndex.familiesBySource.get(source);
    if (!layerFamilies) {
      return;
    }
    const features = new Array(sourceLayer.length);
    for (let index = 0; index < sourceLayer.length; index++) {
      features[index] = { feature: sourceLayer.feature(index), index, sourceLayerIndex: 0 };
    }

    const result = await makeWorkerTile(params, features, layerFamilies.get(sourceLayer.name), resources);

    result.vectorTile = sourceLayer;
    return result;
  }

  return {
    loadData,
    loadTile
  };
}
