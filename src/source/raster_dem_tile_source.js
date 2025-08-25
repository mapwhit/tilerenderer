import DEMData from '../data/dem_data.js';
import browser from '../util/browser.js';
import loadImage from '../util/loader/image.js';
import RasterTileSource from './raster_tile_source.js';
import { calculateKey } from './tile_id.js';

export default class RasterDEMTileSource extends RasterTileSource {
  constructor(id, options, eventedParent) {
    super(id, options, eventedParent);
    this.type = 'raster-dem';
    this.maxzoom = 22;
    this._options = Object.assign({}, options);
    this.encoding = options.encoding || 'mapbox';
  }

  async loadTile(tile) {
    try {
      tile.abortController = new window.AbortController();
      const data = await this.tiles(tile.tileID.canonical, tile.abortController).catch(() => {});
      tile.neighboringTiles = getNeighboringTiles(tile.tileID);
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

  unloadTile(tile) {
    if (tile.demTexture) {
      this.map.painter.saveTileTexture(tile.demTexture);
    }
    if (tile.fbo) {
      tile.fbo.destroy();
      delete tile.fbo;
    }
    if (tile.dem) {
      delete tile.dem;
    }
    delete tile.neighboringTiles;

    tile.state = 'unloaded';
  }
}

// biome-ignore lint/suspicious/useAwait: thread
async function loadDEMTile({ uid, rawImageData, encoding }) {
  return new DEMData(uid, rawImageData, encoding);
}

function getNeighboringTiles(tileID) {
  const {
    canonical: { x, y, z },
    wrap,
    overscaledZ
  } = tileID;
  const dim = 2 ** z;
  const px = (x - 1 + dim) % dim;
  const pxw = x === 0 ? wrap - 1 : wrap;
  const nx = (x + 1 + dim) % dim;
  const nxw = x + 1 === dim ? wrap + 1 : wrap;

  const neighboringTiles = {
    // add adjacent tiles
    [calculateKey(pxw, overscaledZ, px, y)]: { backfilled: false },
    [calculateKey(nxw, overscaledZ, nx, y)]: { backfilled: false }
  };

  // Add upper neighboringTiles
  if (y > 0) {
    neighboringTiles[calculateKey(pxw, overscaledZ, px, y - 1)] = { backfilled: false };
    neighboringTiles[calculateKey(wrap, overscaledZ, x, y - 1)] = { backfilled: false };
    neighboringTiles[calculateKey(nxw, overscaledZ, nx, y - 1)] = { backfilled: false };
  }
  // Add lower neighboringTiles
  if (y + 1 < dim) {
    neighboringTiles[calculateKey(pxw, overscaledZ, px, y + 1)] = { backfilled: false };
    neighboringTiles[calculateKey(wrap, overscaledZ, x, y + 1)] = { backfilled: false };
    neighboringTiles[calculateKey(nxw, overscaledZ, nx, y + 1)] = { backfilled: false };
  }

  return neighboringTiles;
}
