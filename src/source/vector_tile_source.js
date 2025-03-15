const { Event, ErrorEvent, Evented } = require('../util/evented');
const { pick } = require('../util/object');
const loadTileJSON = require('./load_tilejson');
const TileBounds = require('./tile_bounds');
const browser = require('../util/browser');

// register feature index for worker transfer
require('../data/feature_index');

class VectorTileSource extends Evented {
  constructor(id, options, dispatcher, eventedParent) {
    super();
    this.id = id;
    this.dispatcher = dispatcher;

    this.type = 'vector';
    this.minzoom = 0;
    this.maxzoom = 22;
    this.scheme = 'xyz';
    this.tileSize = 512;
    this.reparseOverscaled = true;
    this.isTileClipped = true;

    Object.assign(this, pick(options, ['url', 'scheme', 'tileSize']));
    this._options = Object.assign({ type: 'vector' }, options);

    if (this.tileSize !== 512) {
      throw new Error('vector tile sources must have a tileSize of 512');
    }

    this.setEventedParent(eventedParent);
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

  hasTile(tileID) {
    return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
  }

  onAdd(map) {
    this.map = map;
    this.load();
  }

  serialize() {
    return Object.assign({}, this._options);
  }

  async loadTile(tile) {
    if (tile.workerID != null && tile.state === 'loading') {
      tile.reloadPromise ??= Promise.withResolvers();
      return tile.reloadPromise.promise;
    }
    const data = await this.#loadTile(tile);
    if (tile.reloadPromise) {
      const { resolve, reject } = tile.reloadPromise;
      tile.reloadPromise = null;
      return this.loadTile(tile).then(resolve, reject);
    }
    return data;
  }

  async #loadTile(tile) {
    try {
      tile.abortController = new window.AbortController();
      const rawData = await this.tiles(tile.tileID.canonical, tile.abortController).catch(() => {});
      if (!rawData) {
        const err = new Error('Tile could not be loaded');
        err.status = 404; // will try to use the parent/child tile
        throw err;
      }
      const params = {
        response: { data: rawData },
        uid: tile.uid,
        tileID: tile.tileID,
        zoom: tile.tileID.overscaledZ,
        tileSize: this.tileSize * tile.tileID.overscaleFactor(),
        type: this.type,
        source: this.id,
        pixelRatio: browser.devicePixelRatio,
        showCollisionBoxes: this.map.showCollisionBoxes
      };
      tile.workerID ??= this.dispatcher.nextWorkerId();
      const data = await this.dispatcher.send('loadTile', params, tile.workerID);
      tile.loadVectorData(data, this.map.painter);
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
    tile.aborted = true;
    tile.abortController.abort();
  }

  unloadTile(tile) {
    tile.unloadVectorData();
  }

  hasTransition() {
    return false;
  }
}

module.exports = VectorTileSource;
