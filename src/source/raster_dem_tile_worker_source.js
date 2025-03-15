const DEMData = require('../data/dem_data');

class RasterDEMTileWorkerSource {
  #loaded = {};

  loadTile({ uid, encoding, rawImageData }, callback) {
    const dem = new DEMData(uid, rawImageData, encoding);
    this.#loaded[uid] = dem;
    callback(null, dem);
  }

  removeTile({ uid }) {
    delete this.#loaded[uid];
  }
}

module.exports = RasterDEMTileWorkerSource;
