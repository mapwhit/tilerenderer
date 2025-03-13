const DEMData = require('../data/dem_data');

class RasterDEMTileWorkerSource {
  loadTile({ uid, encoding, rawImageData }) {
    return new DEMData(uid, rawImageData, encoding);
  }
}

module.exports = RasterDEMTileWorkerSource;
