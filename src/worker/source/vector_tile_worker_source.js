const vt = require('@mapbox/vector-tile');
const Protobuf = require('@mapwhit/pbf');
const WorkerTile = require('../worker_tile');

function loadVectorTile({ response }) {
  if (!response) {
    throw new Error('no tile data');
  }
  const { data } = response;
  if (data) {
    return {
      vectorTile: new vt.VectorTile(new Protobuf(data)),
      rawData: data
    };
  }
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
    const { vectorTile, rawData } = await this.loadVectorData(params);
    const workerTile = new WorkerTile(params);
    workerTile.vectorTile = vectorTile;
    const result = await workerTile.parse(vectorTile, this.layerIndex, this.actor);
    this.loaded[params.uid] = workerTile;
    // Transferring a copy of rawTileData because the worker needs to retain its copy.
    return { ...result, rawTileData: rawData.slice() };
  }

  // biome-ignore lint/suspicious/useAwait: need to return a promise
  async reloadTile({ uid, showCollisionBoxes }) {
    const workerTile = this.loaded[uid];
    if (workerTile) {
      workerTile.showCollisionBoxes = showCollisionBoxes;
      return workerTile.parse(workerTile.vectorTile, this.layerIndex, this.actor);
    }
  }

  /**
   * Implements {@link WorkerSource#removeTile}.
   *
   * @param params
   * @param params.uid The UID for this tile.
   */
  removeTile({ uid }) {
    delete this.loaded[uid];
  }

  updateConfig() {}
}

module.exports = VectorTileWorkerSource;
