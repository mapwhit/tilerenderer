const { pick } = require('../util/object');
const loadImage = require('../util/loader/image');
const { Event, ErrorEvent, Evented } = require('../util/evented');
const loadTileJSON = require('./load_tilejson');
const TileBounds = require('./tile_bounds');
const Texture = require('../render/texture');

class RasterTileSource extends Evented {
  constructor(id, options, dispatcher, eventedParent) {
    super();
    this.id = id;
    this.dispatcher = dispatcher;
    this.setEventedParent(eventedParent);

    this.type = 'raster';
    this.minzoom = 0;
    this.maxzoom = 22;
    this.roundZoom = true;
    this.scheme = 'xyz';
    this.tileSize = 512;
    this._loaded = false;

    this._options = Object.assign({}, options);
    Object.assign(this, pick(options, ['url', 'scheme', 'tileSize']));
  }

  async load() {
    this.fire(new Event('dataloading', { dataType: 'source' }));
    try {
      const tileJSON = await loadTileJSON(this._options);
      Object.assign(this, tileJSON);
      if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);

      // `content` is included here to prevent a race condition where `Style#_updateSources` is called
      // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
      // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
      this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
      this.fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
    } catch (err) {
      this.fire(new ErrorEvent(err));
    }
  }

  onAdd(map) {
    this.map = map;
    this.load();
  }

  serialize() {
    return Object.assign({}, this._options);
  }

  hasTile(tileID) {
    return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
  }

  async loadTile(tile) {
    try {
      tile.abortController = new window.AbortController();
      const data = await this.tiles(tile.tileID.canonical, tile.abortController).catch(() => {});
      if (!data) {
        const err = new Error('Tile could not be loaded');
        err.status = 404; // will try to use the parent/child tile
        throw err;
      }
      const img = await loadImage(data);
      if (!img) {
        return;
      }

      tile.texture = this.map.painter.getTileTexture(img.width);
      if (tile.texture) {
        tile.texture.update(img, { useMipmap: true });
      } else {
        const { context } = this.map.painter;
        const { gl } = context;
        tile.texture = new Texture(context, img, gl.RGBA, { useMipmap: true });
        tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        if (context.extTextureFilterAnisotropic) {
          gl.texParameterf(
            gl.TEXTURE_2D,
            context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
            context.extTextureFilterAnisotropicMax
          );
        }
      }

      tile.state = 'loaded';
    } catch (err) {
      if (tile.aborted) {
        tile.state = 'unloaded';
        return;
      }
      tile.state = 'errored';
      throw err;
    }
  }

  abortTile(tile) {
    if (tile.abortController) {
      tile.aborted = true;
      tile.abortController.abort();
      delete tile.abortController;
    }
  }

  unloadTile(tile) {
    if (tile.texture) this.map.painter.saveTileTexture(tile.texture);
  }

  hasTransition() {
    return false;
  }
}

module.exports = RasterTileSource;
