const config = require('../util/config');
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

    this.updateWorkerConfig(config);
    config.on('change', c => this.updateWorkerConfig(c));

    this.setEventedParent(eventedParent);
  }

  load() {
    this.fire(new Event('dataloading', { dataType: 'source' }));

    loadTileJSON(this._options, (err, tileJSON) => {
      if (err) {
        this.fire(new ErrorEvent(err));
      } else if (tileJSON) {
        Object.assign(this, tileJSON);
        if (tileJSON.bounds) this.tileBounds = new TileBounds(tileJSON.bounds, this.minzoom, this.maxzoom);

        // `content` is included here to prevent a race condition where `Style#_updateSources` is called
        // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
        // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
        this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
        this.fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
      }
    });
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

  loadTile(tile, callback) {
    tile.abortController = new window.AbortController();
    this.tiles(tile.tileID.canonical, tile.abortController)
      .catch(() => {})
      .then(data => {
        if (!data) {
          const err = new Error('Tile could not be loaded');
          err.status = 404; // will try to use the parent/child tile
          return done(err);
        }
        const params = {
          response: { data },
          uid: tile.uid,
          tileID: tile.tileID,
          zoom: tile.tileID.overscaledZ,
          tileSize: this.tileSize * tile.tileID.overscaleFactor(),
          type: this.type,
          source: this.id,
          pixelRatio: browser.devicePixelRatio,
          showCollisionBoxes: this.map.showCollisionBoxes
        };

        if (tile.workerID === undefined || tile.state === 'expired') {
          tile.workerID = this.dispatcher.send('loadTile', params, done.bind(this));
        } else if (tile.state === 'loading') {
          // schedule tile reloading after it has been loaded
          tile.reloadCallback = callback;
        } else {
          this.dispatcher.send('reloadTile', params, done.bind(this), tile.workerID);
        }
      });

    function done(err, data) {
      if (tile.aborted) return callback(null);

      if (err) {
        return callback(err);
      }

      tile.loadVectorData(data, this.map.painter);

      callback(null);

      if (tile.reloadCallback) {
        this.loadTile(tile, tile.reloadCallback);
        tile.reloadCallback = null;
      }
    }
  }

  abortTile(tile) {
    tile.aborted = true;
    tile.abortController.abort();
  }

  unloadTile(tile) {
    tile.unloadVectorData();
    this.dispatcher.send('removeTile', { uid: tile.uid, type: this.type, source: this.id }, undefined, tile.workerID);
  }

  hasTransition() {
    return false;
  }

  updateWorkerConfig() {
    this.dispatcher.broadcast('vector.updateConfig', {
      source: this.id
    });
  }
}

module.exports = VectorTileSource;
