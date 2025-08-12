const browser = require('../util/browser');
const loadImage = require('../util/loader/image');
const { OverscaledTileID } = require('./tile_id');
const RasterTileSource = require('./raster_tile_source');
const DEMData = require('../data/dem_data');

class RasterDEMTileSource extends RasterTileSource {
  constructor(id, options, eventedParent) {
    super(id, options, eventedParent);
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

  async loadTile(tile) {
    try {
      tile.abortController = new window.AbortController();
      const data = await this.tiles(tile.tileID.canonical, tile.abortController).catch(() => {});
      tile.neighboringTiles = this._getNeighboringTiles(tile.tileID);
      if (!data) {
        const err = new Error('Tile could not be loaded');
        err.status = 404; // will try to use the parent/child tile
        throw err;
      }
      const img = await loadImage(data);
      if (!img) {
        return;
      }
      if (!tile.dem) {
        const rawImageData = browser.getImageData(img);
        const params = {
          uid: tile.uid,
          coord: tile.tileID,
          source: this.id,
          rawImageData,
          encoding: this.encoding
        };
        const dem = await loadDEMTile(params);
        if (dem) {
          tile.dem = dem;
          tile.needsHillshadePrepare = true;
          tile.state = 'loaded';
        }
      }
    } catch (err) {
      if (tile.aborted) {
        tile.state = 'unloaded';
        return;
      }
      tile.state = 'errored';
      throw err;
    }
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
  }
}

// biome-ignore lint/suspicious/useAwait: thread
async function loadDEMTile({ uid, rawImageData, encoding }) {
  return new DEMData(uid, rawImageData, encoding);
}

module.exports = RasterDEMTileSource;
