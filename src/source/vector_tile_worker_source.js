import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import makeWorkerTile from './worker_tile.js';

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory VectorTile
 * representation.  To do so, create it with
 * `new VectorTileWorkerSource(resources, styleLayers, customLoadVectorDataFunction)`.
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
  constructor(resources, layerIndex) {
    this.resources = resources;
    this.layerIndex = layerIndex;
  }

  loadVectorData(params) {
    if (!params.response) {
      throw new Error('no tile data');
    }
    const { data } = params.response;
    if (!data) {
      return;
    }
    return {
      vectorTile: new VectorTile(new Protobuf(data))
    };
  }

  /**
   * Implements {@link WorkerSource#loadTile}. Delegates to
   * {@link VectorTileWorkerSource#loadVectorData} (which by default expects
   * a `params.url` property) for fetching and producing a VectorTile object.
   */
  async loadTile(params) {
    const response = this.loadVectorData(params);
    if (!response) {
      return;
    }
    const { vectorTile } = response;
    const result = await makeWorkerTile(params, vectorTile, this.layerIndex, this.resources);
    if (vectorTile) {
      result.vectorTile = vectorTile;
    }
    return result;
  }
}

export default VectorTileWorkerSource;
