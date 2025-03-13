const vt = require('@mapbox/vector-tile');
const Protobuf = require('@mapwhit/pbf');
const WorkerTile = require('./worker_tile');
const { callback } = require('../util/callback');

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
  loadTile(params, fn) {
    return callback(fn, perform.call(this));

    async function perform() {
      const uid = params.uid;

      const workerTile = new WorkerTile(params);
      const response = this.loadVectorData(params);
      if (!response) {
        return;
      }

      workerTile.vectorTile = response.vectorTile;
      // Transferring a copy of rawTileData because the worker needs to retain its copy.
      const parsingPromise = workerTile.parse(response.vectorTile, this.layerIndex, this.actor);

      this.loaded = this.loaded || {};
      this.loaded[uid] = workerTile;
      const result = await parsingPromise;

      const rawTileData = response.rawData;
      return { rawTileData: rawTileData.slice(0), ...result };
    }
  }

  /**
   * Implements {@link WorkerSource#reloadTile}.
   */
  reloadTile(params, callback) {
    const loaded = this.loaded;
    const uid = params.uid;
    const vtSource = this;
    if (loaded?.[uid]) {
      const workerTile = loaded[uid];
      workerTile.showCollisionBoxes = params.showCollisionBoxes;

      const done = (err, data) => {
        const reloadCallback = workerTile.reloadCallback;
        if (reloadCallback) {
          delete workerTile.reloadCallback;
          workerTile
            .parse(workerTile.vectorTile, vtSource.layerIndex, vtSource.actor)
            .then(result => reloadCallback(null, result), reloadCallback);
        }
        callback(err, data);
      };

      if (workerTile.status === 'parsing') {
        workerTile.reloadCallback = done;
      } else if (workerTile.status === 'done') {
        workerTile.parse(workerTile.vectorTile, this.layerIndex, this.actor).then(result => done(null, result), done);
      }
    }
  }

  /**
   * Implements {@link WorkerSource#removeTile}.
   *
   * @param params
   * @param params.uid The UID for this tile.
   */
  removeTile(params, callback) {
    const loaded = this.loaded;
    const uid = params.uid;
    if (loaded?.[uid]) {
      delete loaded[uid];
    }
    callback();
  }

  updateConfig() {}
}

module.exports = VectorTileWorkerSource;
