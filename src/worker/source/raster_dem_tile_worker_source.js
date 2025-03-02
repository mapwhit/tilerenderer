const DEMData = require('../../data/dem_data');

class RasterDEMTileWorkerSource {
  loadTile({ uid, encoding, rawImageData }) {
    const dem = new DEMData(uid, rawImageData, encoding);
    return Promise.resolve(dem);
  }

  removeTile() {
    // no-op
  }
}

module.exports = RasterDEMTileWorkerSource;
