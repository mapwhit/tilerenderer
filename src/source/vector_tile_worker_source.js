const vt = require('@mapbox/vector-tile');
const Protobuf = require('@mapwhit/pbf');
const WorkerTile = require('./worker_tile');

function loadVectorTile(params) {
  if (!params.response) {
    throw new Error('no tile data');
  }
  const { data } = params.response;
  if (!data) {
    return;
  }
  return {
    vectorTile: new vt.VectorTile(new Protobuf(data)),
    rawData: data
  };
}

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(actor, styleLayers, customLoadVectorDataFunction)`.
 *
 * @private
 */
class VectorTileWorkerSource {
  /**
   * @param [loadVectorData] Optional method for custom loading of a VectorTile
   * object based on parameters passed from the main-thread Source. See
   * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
   * loads the pbf at `params.url`.
   */
  constructor(actor, layerIndex, loadVectorData = loadVectorTile) {
    this.actor = actor;
    this.layerIndex = layerIndex;
    this.loadVectorData = loadVectorData;
    this.loaded = {};
  }

  /**
   * Implements {@link WorkerSource#loadTile}. Delegates to
   * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
   * a `params.url` property) for fetching and producing a VectorTile object.
   */
  async loadTile(params) {
    const workerTile = new WorkerTile(params);
    try {
      const uid = params.uid;

      const response = this.loadVectorData(params);
      if (!response) {
        return;
      }

      workerTile.vectorTile = response.vectorTile;
      // Transferring a copy of rawTileData because the worker needs to retain its copy.
      workerTile.parsingPromise = workerTile.parse(response.vectorTile, this.layerIndex, this.actor);

      this.loaded ??= {};
      this.loaded[uid] = workerTile;
      const result = await workerTile.parsingPromise;

      const rawTileData = response.rawData;
      return { rawTileData: rawTileData.slice(0), ...result };
    } finally {
      delete workerTile.parsingPromise;
    }
  }

  /**
   * Implements {@link WorkerSource#reloadTile}.
   */
  async reloadTile(params) {
    const workerTile = this.loaded?.[params.uid];
    if (!workerTile) {
      return;
    }
    while (workerTile.parsingPromise) {
      // If the tile is already being parsed, wait for the parsing to finish
      await workerTile.parsingPromise;
    }
    try {
      workerTile.showCollisionBoxes = params.showCollisionBoxes;
      workerTile.parsingPromise = workerTile.parse(workerTile.vectorTile, this.layerIndex, this.actor);
      return await workerTile.parsingPromise;
    } finally {
      delete workerTile.parsingPromise;
    }
  }

  /**
   * Implements {@link WorkerSource#removeTile}.
   *
   * @param params
   * @param params.uid The UID for this tile.
   */
  removeTile(params) {
    delete this.loaded?.[params.uid];
  }
}

module.exports = VectorTileWorkerSource;
