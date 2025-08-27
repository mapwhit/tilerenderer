import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import makeWorkerTile from './worker_tile.js';

/**
 * The {@link WorkerSource} implementation that supports {@link VectorTileSource}.
 *
 * @private
 */
class VectorTileWorkerSource {
  /**
   * {@link VectorTileWorkerSource#loadTile}. The default implementation simply
   * loads the pbf at `params.url`.
   */
  constructor(resources, layerIndex) {
    this.resources = resources;
    this.layerIndex = layerIndex;
  }

  /**
   * Implements {@link WorkerSource#loadTile}.
   */
  async loadTile(params) {
    if (!params.response) {
      throw new Error('no tile data');
    }
    const { data } = params.response;
    if (!data) {
      return;
    }
    const vectorTile = new VectorTile(new Protobuf(data));
    const result = await makeWorkerTile(params, vectorTile, this.layerIndex, this.resources);
    result.vectorTile = vectorTile;
    return result;
  }
}

export default VectorTileWorkerSource;
