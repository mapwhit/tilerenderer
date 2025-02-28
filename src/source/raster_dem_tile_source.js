const browser = require('../util/browser');
const loadImage = require('../util/loader/image');
const { OverscaledTileID } = require('./tile_id');
const RasterTileSource = require('./raster_tile_source');
// ensure DEMData is registered for worker transfer on main thread:
require('../data/dem_data');

class RasterDEMTileSource extends RasterTileSource {
  constructor(id, options, dispatcher, eventedParent) {
    super(id, options, dispatcher, eventedParent);
    this.type = 'raster-dem';
    this.maxzoom = 22;
    this._options = Object.assign({}, options);
    this.encoding = options.encoding || 'mapbox';
  }

  serialize() {
    return {
      type: 'raster-dem',
      url: this.url,
      tileSize: this.tileSize,
      tiles: this.tiles,
      bounds: this.bounds,
      encoding: this.encoding
    };
  }

  loadTile(tile, callback) {
    const done = (err, dem) => {
      if (err) {
        tile.state = 'errored';
        callback(err);
      }

      if (dem) {
        tile.dem = dem;
        tile.needsHillshadePrepare = true;
        tile.state = 'loaded';
        callback();
      }
    };
    const imageLoaded = (err, img) => {
      delete tile.request;
      if (tile.aborted) {
        tile.state = 'unloaded';
        callback();
      } else if (err) {
        tile.state = 'errored';
        callback(err);
      } else if (img) {
        const rawImageData = browser.getImageData(img);
        const params = {
          uid: tile.uid,
          coord: tile.tileID,
          source: this.id,
          rawImageData: rawImageData,
          encoding: this.encoding
        };

        if (!tile.workerID || tile.state === 'expired') {
          tile.workerID = this.dispatcher.nextWorkerId();
          this.dispatcher.send('loadDEMTile', params, tile.workerID).then(data => done(null, data), done);
        }
      }
    };

    tile.abortController = new window.AbortController();
    this.tiles(tile.tileID.canonical, tile.abortController)
      .catch(() => {})
      .then(data => {
        tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
        if (!data) {
          const err = new Error('Tile could not be loaded');
          err.status = 404; // will try to use the parent/child tile
          return done(err);
        }
        tile.request = loadImage(data, imageLoaded);
      });
  }

  _getNeighboringTiles(tileID) {
    const canonical = tileID.canonical;
    const dim = 2 ** canonical.z;

    const px = (canonical.x - 1 + dim) % dim;
    const pxw = canonical.x === 0 ? tileID.wrap - 1 : tileID.wrap;
    const nx = (canonical.x + 1 + dim) % dim;
    const nxw = canonical.x + 1 === dim ? tileID.wrap + 1 : tileID.wrap;

    const neighboringTiles = {};
    // add adjacent tiles
    neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y).key] = {
      backfilled: false
    };
    neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y).key] = {
      backfilled: false
    };

    // Add upper neighboringTiles
    if (canonical.y > 0) {
      neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y - 1).key] = {
        backfilled: false
      };
      neighboringTiles[
        new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y - 1).key
      ] = { backfilled: false };
      neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y - 1).key] = {
        backfilled: false
      };
    }
    // Add lower neighboringTiles
    if (canonical.y + 1 < dim) {
      neighboringTiles[new OverscaledTileID(tileID.overscaledZ, pxw, canonical.z, px, canonical.y + 1).key] = {
        backfilled: false
      };
      neighboringTiles[
        new OverscaledTileID(tileID.overscaledZ, tileID.wrap, canonical.z, canonical.x, canonical.y + 1).key
      ] = { backfilled: false };
      neighboringTiles[new OverscaledTileID(tileID.overscaledZ, nxw, canonical.z, nx, canonical.y + 1).key] = {
        backfilled: false
      };
    }

    return neighboringTiles;
  }

  unloadTile(tile) {
    if (tile.demTexture) this.map.painter.saveTileTexture(tile.demTexture);
    if (tile.fbo) {
      tile.fbo.destroy();
      delete tile.fbo;
    }
    if (tile.dem) delete tile.dem;
    delete tile.neighboringTiles;

    tile.state = 'unloaded';
    this.dispatcher.send('removeDEMTile', { uid: tile.uid, source: this.id }, tile.workerID);
  }
}

module.exports = RasterDEMTileSource;
