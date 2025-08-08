const test = require('node:test');
const SourceCache = require('../../../src/source/source_cache');
const { setType } = require('../../../src/source/source');
const Tile = require('../../../src/source/tile');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const Transform = require('../../../src/geo/transform');
const LngLat = require('../../../src/geo/lng_lat');
const { default: Point } = require('@mapbox/point-geometry');
const { Event, ErrorEvent, Evented } = require('@mapwhit/events');
const browser = require('../../../src/util/browser');

// Add a mocked source type for use in these tests
function MockSourceType(id, sourceOptions, _dispatcher, eventedParent) {
  // allow tests to override mocked methods/properties by providing
  // them in the source definition object that's given to Source.create()
  class SourceMock extends Evented {
    constructor() {
      super();
      this.id = id;
      this.minzoom = 0;
      this.maxzoom = 22;
      Object.assign(this, sourceOptions);
      this.setEventedParent(eventedParent);
      if (sourceOptions.hasTile) {
        this.hasTile = sourceOptions.hasTile;
      }
    }
    async loadTile() {}
    onAdd() {
      if (sourceOptions.noLoad) return;
      if (sourceOptions.error) {
        this.fire(new ErrorEvent(sourceOptions.error));
      } else {
        this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
      }
    }
    abortTile() {}
    unloadTile() {}
    serialize() {}
  }
  const source = new SourceMock();

  return source;
}

setType('mock-source-type', MockSourceType);

function createSourceCache(options, used) {
  const sc = new SourceCache(
    'id',
    Object.assign(
      {
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        type: 'mock-source-type'
      },
      options
    ),
    /* dispatcher */ {}
  );
  sc.used = typeof used === 'boolean' ? used : true;
  return sc;
}

test('SourceCache.addTile', async t => {
  await t.test('loads tile when uncached', (t, done) => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const sourceCache = createSourceCache({
      loadTile(tile) {
        t.assert.deepEqual(tile.tileID, tileID);
        t.assert.equal(tile.uses, 0);
        done();
        return Promise.resolve();
      }
    });
    sourceCache.onAdd();
    sourceCache._addTile(tileID);
  });

  await t.test('adds tile when uncached', (t, done) => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const sourceCache = createSourceCache({}).on('dataloading', data => {
      t.assert.deepEqual(data.tile.tileID, tileID);
      t.assert.equal(data.tile.uses, 1);
      done();
    });
    sourceCache.onAdd();
    sourceCache._addTile(tileID);
  });

  await t.test('updates feature state on added uncached tile', (t, done) => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    let updateFeaturesSpy;
    const sourceCache = createSourceCache({
      loadTile(tile) {
        sourceCache.on('data', () => {
          t.assert.equal(updateFeaturesSpy.mock.callCount(), 1);
          done();
        });
        updateFeaturesSpy = t.mock.method(tile, 'setFeatureState');
        tile.state = 'loaded';
        return Promise.resolve();
      }
    });
    sourceCache.onAdd();
    sourceCache._addTile(tileID);
  });

  await t.test('uses cached tile', t => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    let load = 0;
    let add = 0;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        load++;
        return Promise.resolve();
      }
    }).on('dataloading', () => {
      add++;
    });

    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);
    sourceCache._addTile(tileID);
    sourceCache._removeTile(tileID.key);
    sourceCache._addTile(tileID);

    t.assert.equal(load, 1);
    t.assert.equal(add, 1);
  });

  await t.test('updates feature state on cached tile', t => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        return Promise.resolve();
      }
    });

    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);

    const tile = sourceCache._addTile(tileID);
    const updateFeaturesSpy = t.mock.method(tile, 'setFeatureState');

    sourceCache._removeTile(tileID.key);
    sourceCache._addTile(tileID);

    t.assert.equal(updateFeaturesSpy.mock.callCount(), 1);
  });

  await t.test('does not reuse wrapped tile', t => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    let load = 0;
    let add = 0;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        load++;
        return Promise.resolve();
      }
    }).on('dataloading', () => {
      add++;
    });

    const t1 = sourceCache._addTile(tileID);
    const t2 = sourceCache._addTile(new OverscaledTileID(0, 1, 0, 0, 0));

    t.assert.equal(load, 2);
    t.assert.equal(add, 2);
    t.assert.notEqual(t1, t2);
  });
});

test('SourceCache.removeTile', async t => {
  await t.test('removes tile', (t, done) => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const sourceCache = createSourceCache({});
    sourceCache._addTile(tileID);
    sourceCache.on('data', () => {
      sourceCache._removeTile(tileID.key);
      t.assert.ok(!sourceCache._tiles[tileID.key]);
      done();
    });
  });

  await t.test('caches (does not unload) loaded tile', t => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        return Promise.resolve();
      },
      unloadTile: function () {
        t.assert.fail();
      }
    });

    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);

    sourceCache._addTile(tileID);
    sourceCache._removeTile(tileID.key);
  });

  await t.test('aborts and unloads unfinished tile', t => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    let abort = 0;
    let unload = 0;

    const sourceCache = createSourceCache({
      abortTile: function (tile) {
        t.assert.deepEqual(tile.tileID, tileID);
        abort++;
      },
      unloadTile: function (tile) {
        t.assert.deepEqual(tile.tileID, tileID);
        unload++;
      }
    });

    sourceCache._addTile(tileID);
    sourceCache._removeTile(tileID.key);

    t.assert.equal(abort, 1);
    t.assert.equal(unload, 1);
  });

  await t.test('_tileLoaded after _removeTile skips tile.added', t => {
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.added = () => t.assert.fail('should not be called');
        sourceCache._removeTile(tileID.key);
        return Promise.resolve();
      }
    });
    sourceCache.map = { painter: { crossTileSymbolIndex: '', tileExtentVAO: {} } };

    sourceCache._addTile(tileID);
  });
});

test('SourceCache / Source lifecycle', async t => {
  await t.test('does not fire load or change before source load event', (t, done) => {
    const sourceCache = createSourceCache({ noLoad: true }).on('data', t.fail);
    sourceCache.onAdd();
    setTimeout(done, 1);
  });

  await t.test('forward load event', (t, done) => {
    const sourceCache = createSourceCache({}).on('data', e => {
      if (e.sourceDataType === 'metadata') {
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('forward change event', (t, done) => {
    const sourceCache = createSourceCache().on('data', e => {
      if (e.sourceDataType === 'metadata') {
        done();
      }
    });
    sourceCache.onAdd();
    sourceCache.getSource().fire(new Event('data'));
  });

  await t.test('forward error event', (t, done) => {
    const sourceCache = createSourceCache({ error: 'Error loading source' }).on('error', err => {
      t.assert.equal(err.error, 'Error loading source');
      done();
    });
    sourceCache.onAdd();
  });

  await t.test('suppress 404 errors', t => {
    const sourceCache = createSourceCache({ status: 404, message: 'Not found' }).on('error', t.fail);
    sourceCache.onAdd();
  });

  await t.test('loaded() true after source error', (t, done) => {
    const sourceCache = createSourceCache({ error: 'Error loading source' }).on('error', () => {
      t.assert.ok(sourceCache.loaded());
      done();
    });
    sourceCache.onAdd();
  });

  await t.test('loaded() true after tile error', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;
    const sourceCache = createSourceCache({
      loadTile(tile) {
        return Promise.reject('error');
      }
    })
      .on('data', e => {
        if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
          sourceCache.update(transform);
        }
      })
      .on('error', () => {
        t.assert.ok(sourceCache.loaded());
        done();
      });

    sourceCache.onAdd();
  });

  await t.test('reloads tiles after a data event where source is updated', { plan: 2 }, (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;

    const expected = [new OverscaledTileID(0, 0, 0, 0, 0).key, new OverscaledTileID(0, 0, 0, 0, 0).key];

    const sourceCache = createSourceCache({
      loadTile(tile) {
        t.assert.equal(tile.tileID.key, expected.shift());
        tile.loaded = true;
        if (expected.length === 0) {
          setImmediate(done);
        }
        return Promise.resolve();
      }
    });

    sourceCache.on('data', e => {
      if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        sourceCache.getSource().fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
      }
    });

    sourceCache.onAdd();
  });

  await t.test('does not reload errored tiles', t => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 1;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        // this transform will try to load the four tiles at z1 and a single z0 tile
        // we only expect _reloadTile to be called with the 'loaded' z0 tile
        tile.state = tile.tileID.canonical.z === 1 ? 'errored' : 'loaded';
        return Promise.resolve();
      }
    });

    const reloadTileSpy = t.mock.method(sourceCache, '_reloadTile');
    sourceCache.on('data', e => {
      if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        sourceCache.getSource().fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
      }
    });
    sourceCache.onAdd();
    // we expect the source cache to have five tiles, but only to have reloaded one
    t.assert.equal(Object.keys(sourceCache._tiles).length, 5);
    t.assert.equal(reloadTileSpy.mock.callCount(), 1);
  });
});

test('SourceCache.update', async t => {
  await t.test('loads no tiles if used is false', (t, done) => {
    const transform = new Transform();
    transform.resize(512, 512);
    transform.zoom = 0;

    const sourceCache = createSourceCache({}, false);
    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), []);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('loads covering tiles', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;

    const sourceCache = createSourceCache({});
    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 0, 0, 0, 0).key]);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('respects Source.hasTile method if it is present', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 1;

    const sourceCache = createSourceCache({
      hasTile: coord => coord.canonical.x !== 0
    });
    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(
          sourceCache.getIds().sort(),
          [new OverscaledTileID(1, 0, 1, 1, 0).key, new OverscaledTileID(1, 0, 1, 1, 1).key].sort()
        );
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('removes unused tiles', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        return Promise.resolve();
      }
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 0, 0, 0, 0).key]);

        transform.zoom = 1;
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getIds(), [
          new OverscaledTileID(1, 0, 1, 1, 1).key,
          new OverscaledTileID(1, 0, 1, 0, 1).key,
          new OverscaledTileID(1, 0, 1, 1, 0).key,
          new OverscaledTileID(1, 0, 1, 0, 0).key
        ]);
        done();
      }
    });

    sourceCache.onAdd();
  });

  await t.test('retains parent tiles for pending children', (t, done) => {
    const transform = new Transform();
    transform._test = 'retains';
    transform.resize(511, 511);
    transform.zoom = 0;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = tile.tileID.key === new OverscaledTileID(0, 0, 0, 0, 0).key ? 'loaded' : 'loading';
        return Promise.resolve();
      }
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 0, 0, 0, 0).key]);

        transform.zoom = 1;
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getIds(), [
          new OverscaledTileID(0, 0, 0, 0, 0).key,
          new OverscaledTileID(1, 0, 1, 1, 1).key,
          new OverscaledTileID(1, 0, 1, 0, 1).key,
          new OverscaledTileID(1, 0, 1, 1, 0).key,
          new OverscaledTileID(1, 0, 1, 0, 0).key
        ]);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('retains parent tiles for pending children (wrapped)', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;
    transform.center = new LngLat(360, 0);

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = tile.tileID.key === new OverscaledTileID(0, 1, 0, 0, 0).key ? 'loaded' : 'loading';
        return Promise.resolve();
      }
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 1, 0, 0, 0).key]);

        transform.zoom = 1;
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getIds(), [
          new OverscaledTileID(0, 1, 0, 0, 0).key,
          new OverscaledTileID(1, 1, 1, 1, 1).key,
          new OverscaledTileID(1, 1, 1, 0, 1).key,
          new OverscaledTileID(1, 1, 1, 1, 0).key,
          new OverscaledTileID(1, 1, 1, 0, 0).key
        ]);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('retains covered child tiles while parent tile is fading in', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 2;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.timeAdded = Number.POSITIVE_INFINITY;
        tile.state = 'loaded';
        tile.registerFadeDuration(100);
        return Promise.resolve();
      }
    });

    sourceCache._source.type = 'raster';

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [
          new OverscaledTileID(2, 0, 2, 2, 2).key,
          new OverscaledTileID(2, 0, 2, 1, 2).key,
          new OverscaledTileID(2, 0, 2, 2, 1).key,
          new OverscaledTileID(2, 0, 2, 1, 1).key
        ]);

        transform.zoom = 0;
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getRenderableIds().length, 5);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('retains a parent tile for fading even if a tile is partially covered by children', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.timeAdded = Number.POSITIVE_INFINITY;
        tile.state = 'loaded';
        tile.registerFadeDuration(100);
        return Promise.resolve();
      }
    });

    sourceCache._source.type = 'raster';

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);

        transform.zoom = 2;
        sourceCache.update(transform);

        transform.zoom = 1;
        sourceCache.update(transform);

        t.assert.equal(sourceCache._coveredTiles[new OverscaledTileID(0, 0, 0, 0, 0).key], true);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('retains children for fading when tile.fadeEndTime is not set', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 1;

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.timeAdded = Date.now();
        tile.state = 'loaded';
        return Promise.resolve();
      }
    });

    sourceCache._source.type = 'raster';

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);

        transform.zoom = 0;
        sourceCache.update(transform);

        t.assert.equal(sourceCache.getRenderableIds().length, 5, 'retains 0/0/0 and its four children');
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('retains children when tile.fadeEndTime is in the future', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 1;

    const fadeTime = 100;

    const start = Date.now();
    let time = start;
    t.mock.method(browser, 'now', () => time);

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.timeAdded = browser.now();
        tile.state = 'loaded';
        tile.fadeEndTime = browser.now() + fadeTime;
        return Promise.resolve();
      }
    });

    sourceCache._source.type = 'raster';

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        // load children
        sourceCache.update(transform);

        transform.zoom = 0;
        sourceCache.update(transform);

        t.assert.equal(sourceCache.getRenderableIds().length, 5, 'retains 0/0/0 and its four children');

        time = start + 98;
        sourceCache.update(transform);
        t.assert.equal(sourceCache.getRenderableIds().length, 5, 'retains 0/0/0 and its four children');

        time = start + fadeTime + 1;
        sourceCache.update(transform);
        t.assert.equal(sourceCache.getRenderableIds().length, 1, 'drops children after fading is complete');
        done();
      }
    });

    sourceCache.onAdd();
  });

  await t.test('retains overscaled loaded children', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 16;

    // use slightly offset center so that sort order is better defined
    transform.center = new LngLat(-0.001, 0.001);

    const sourceCache = createSourceCache({
      reparseOverscaled: true,
      loadTile(tile) {
        tile.state = tile.tileID.overscaledZ === 16 ? 'loaded' : 'loading';
        return Promise.resolve();
      }
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getRenderableIds(), [
          new OverscaledTileID(16, 0, 16, 8192, 8192).key,
          new OverscaledTileID(16, 0, 16, 8191, 8192).key,
          new OverscaledTileID(16, 0, 16, 8192, 8191).key,
          new OverscaledTileID(16, 0, 16, 8191, 8191).key
        ]);

        transform.zoom = 15;
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getRenderableIds(), [
          new OverscaledTileID(16, 0, 16, 8192, 8192).key,
          new OverscaledTileID(16, 0, 16, 8191, 8192).key,
          new OverscaledTileID(16, 0, 16, 8192, 8191).key,
          new OverscaledTileID(16, 0, 16, 8191, 8191).key
        ]);
        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('reassigns tiles for large jumps in longitude', (t, done) => {
    const transform = new Transform();
    transform.resize(511, 511);
    transform.zoom = 0;

    const sourceCache = createSourceCache({});
    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        transform.center = new LngLat(360, 0);
        const tileID = new OverscaledTileID(0, 1, 0, 0, 0);
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [tileID.key]);
        const tile = sourceCache.getTile(tileID);

        transform.center = new LngLat(0, 0);
        const wrappedTileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache.update(transform);
        t.assert.deepEqual(sourceCache.getIds(), [wrappedTileID.key]);
        t.assert.equal(sourceCache.getTile(wrappedTileID), tile);
        done();
      }
    });
    sourceCache.onAdd();
  });
});

test('SourceCache._updateRetainedTiles', async t => {
  await t.test('loads ideal tiles if they exist', t => {
    const stateCache = {};
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = stateCache[tile.tileID.key] || 'errored';
        return Promise.resolve();
      }
    });

    const getTileSpy = t.mock.method(sourceCache, 'getTile');
    const idealTile = new OverscaledTileID(1, 0, 1, 1, 1);
    stateCache[idealTile.key] = 'loaded';
    sourceCache._updateRetainedTiles([idealTile], 1);
    t.assert.equal(getTileSpy.mock.callCount(), 0);
    t.assert.deepEqual(sourceCache.getIds(), [idealTile.key]);
  });

  await t.test('retains all loaded children ', t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'errored';
        return Promise.resolve();
      }
    });

    const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);
    sourceCache._tiles[idealTile.key] = new Tile(idealTile);
    sourceCache._tiles[idealTile.key].state = 'errored';

    const loadedChildren = [
      new OverscaledTileID(4, 0, 4, 2, 4),
      new OverscaledTileID(4, 0, 4, 3, 4),
      new OverscaledTileID(4, 0, 4, 2, 5),
      new OverscaledTileID(5, 0, 5, 6, 10),
      new OverscaledTileID(5, 0, 5, 7, 10),
      new OverscaledTileID(5, 0, 5, 6, 11),
      new OverscaledTileID(5, 0, 5, 7, 11)
    ];

    for (const t of loadedChildren) {
      sourceCache._tiles[t.key] = new Tile(t);
      sourceCache._tiles[t.key].state = 'loaded';
    }

    const retained = sourceCache._updateRetainedTiles([idealTile], 3);
    t.assert.deepEqual(
      Object.keys(retained),
      [
        // parents are requested because ideal ideal tile is not completely covered by
        // loaded child tiles
        new OverscaledTileID(0, 0, 0, 0, 0),
        new OverscaledTileID(1, 0, 1, 0, 0),
        new OverscaledTileID(2, 0, 2, 0, 1),
        idealTile
      ]
        .concat(loadedChildren)
        .map(t => String(t.key))
    );
  });

  await t.test('adds parent tile if ideal tile errors and no child tiles are loaded', t => {
    const stateCache = {};
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = stateCache[tile.tileID.key] || 'errored';
        return Promise.resolve();
      }
    });

    const addTileSpy = t.mock.method(sourceCache, '_addTile');
    const getTileSpy = t.mock.method(sourceCache, 'getTile');

    const idealTiles = [new OverscaledTileID(1, 0, 1, 1, 1), new OverscaledTileID(1, 0, 1, 0, 1)];
    stateCache[idealTiles[0].key] = 'loaded';
    const retained = sourceCache._updateRetainedTiles(idealTiles, 1);
    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // when child tiles aren't found, check and request parent tile
        new OverscaledTileID(0, 0, 0, 0, 0)
      ]
    );

    // retained tiles include all ideal tiles and any parents that were loaded to cover
    // non-existant tiles
    t.assert.deepEqual(retained, {
      // parent
      0: new OverscaledTileID(0, 0, 0, 0, 0),
      //  1/0/1
      65: new OverscaledTileID(1, 0, 1, 0, 1),
      // 1/1/1
      97: new OverscaledTileID(1, 0, 1, 1, 1)
    });
  });

  await t.test("don't use wrong parent tile", t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'errored';
        return Promise.resolve();
      }
    });

    const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
    sourceCache._tiles[idealTile.key] = new Tile(idealTile);
    sourceCache._tiles[idealTile.key].state = 'errored';

    sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key] = new Tile(new OverscaledTileID(1, 0, 1, 1, 0));
    sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key].state = 'loaded';

    const addTileSpy = t.mock.method(sourceCache, '_addTile');
    const getTileSpy = t.mock.method(sourceCache, 'getTile');

    sourceCache._updateRetainedTiles([idealTile], 2);
    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // parents
        new OverscaledTileID(1, 0, 1, 0, 0), // not found
        new OverscaledTileID(0, 0, 0, 0, 0) // not found
      ]
    );

    t.assert.deepEqual(
      addTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // ideal tile
        new OverscaledTileID(2, 0, 2, 0, 0),
        // parents
        new OverscaledTileID(1, 0, 1, 0, 0), // not found
        new OverscaledTileID(0, 0, 0, 0, 0) // not found
      ]
    );
  });

  await t.test('use parent tile when ideal tile is not loaded', t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      }
    });
    const idealTile = new OverscaledTileID(1, 0, 1, 0, 1);
    sourceCache._tiles[idealTile.key] = new Tile(idealTile);
    sourceCache._tiles[idealTile.key].state = 'loading';
    sourceCache._tiles['0'] = new Tile(new OverscaledTileID(0, 0, 0, 0, 0));
    sourceCache._tiles['0'].state = 'loaded';

    const addTileSpy = t.mock.method(sourceCache, '_addTile');
    const getTileSpy = t.mock.method(sourceCache, 'getTile');

    const retained = sourceCache._updateRetainedTiles([idealTile], 1);

    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // parents
        new OverscaledTileID(0, 0, 0, 0, 0) // found
      ]
    );

    t.assert.deepEqual(
      retained,
      {
        // parent of ideal tile 0/0/0
        0: new OverscaledTileID(0, 0, 0, 0, 0),
        // ideal tile id 1/0/1
        65: new OverscaledTileID(1, 0, 1, 0, 1)
      },
      "retain ideal and parent tile when ideal tiles aren't loaded"
    );

    addTileSpy.mock.resetCalls();
    getTileSpy.mock.resetCalls();

    // now make sure we don't retain the parent tile when the ideal tile is loaded
    sourceCache._tiles[idealTile.key].state = 'loaded';
    const retainedLoaded = sourceCache._updateRetainedTiles([idealTile], 1);

    t.assert.equal(getTileSpy.mock.callCount(), 0);
    t.assert.deepEqual(
      retainedLoaded,
      {
        // only ideal tile retained
        65: new OverscaledTileID(1, 0, 1, 0, 1)
      },
      "only retain ideal tiles when they're all loaded"
    );
  });

  await t.test("don't load parent if all immediate children are loaded", t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      }
    });

    const idealTile = new OverscaledTileID(2, 0, 2, 1, 1);
    const loadedTiles = [
      new OverscaledTileID(3, 0, 3, 2, 2),
      new OverscaledTileID(3, 0, 3, 3, 2),
      new OverscaledTileID(3, 0, 3, 2, 3),
      new OverscaledTileID(3, 0, 3, 3, 3)
    ];
    loadedTiles.forEach(t => {
      sourceCache._tiles[t.key] = new Tile(t);
      sourceCache._tiles[t.key].state = 'loaded';
    });

    const getTileSpy = t.mock.method(sourceCache, 'getTile');
    const retained = sourceCache._updateRetainedTiles([idealTile], 2);
    // parent tile isn't requested because all covering children are loaded
    t.assert.equal(getTileSpy.mock.callCount(), 0);
    t.assert.deepEqual(Object.keys(retained), [idealTile.key].concat(loadedTiles.map(t => t.key)));
  });

  await t.test('prefer loaded child tiles to parent tiles', t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      }
    });
    const idealTile = new OverscaledTileID(1, 0, 1, 0, 0);
    const loadedTiles = [new OverscaledTileID(0, 0, 0, 0, 0), new OverscaledTileID(2, 0, 2, 0, 0)];
    loadedTiles.forEach(t => {
      sourceCache._tiles[t.key] = new Tile(t);
      sourceCache._tiles[t.key].state = 'loaded';
    });

    const getTileSpy = t.mock.method(sourceCache, 'getTile');
    let retained = sourceCache._updateRetainedTiles([idealTile], 1);
    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // parent
        new OverscaledTileID(0, 0, 0, 0, 0)
      ]
    );

    t.assert.deepEqual(
      retained,
      {
        // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
        // tiles, so we still need to load the parent)
        0: new OverscaledTileID(0, 0, 0, 0, 0),
        // ideal tile id (1, 0, 0)
        1: new OverscaledTileID(1, 0, 1, 0, 0),
        // loaded child tile (2, 0, 0)
        2: new OverscaledTileID(2, 0, 2, 0, 0)
      },
      'retains children and parent when ideal tile is partially covered by a loaded child tile'
    );

    getTileSpy.mock.restore();
    // remove child tile and check that it only uses parent tile
    delete sourceCache._tiles['2'];
    retained = sourceCache._updateRetainedTiles([idealTile], 1);

    t.assert.deepEqual(
      retained,
      {
        // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
        // tiles, so we still need to load the parent)
        0: new OverscaledTileID(0, 0, 0, 0, 0),
        // ideal tile id (1, 0, 0)
        1: new OverscaledTileID(1, 0, 1, 0, 0)
      },
      'only retains parent tile if no child tiles are loaded'
    );
  });

  await t.test("don't use tiles below minzoom", t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      },
      minzoom: 2
    });
    const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
    const loadedTiles = [new OverscaledTileID(1, 0, 1, 0, 0)];
    loadedTiles.forEach(t => {
      sourceCache._tiles[t.key] = new Tile(t);
      sourceCache._tiles[t.key].state = 'loaded';
    });

    const getTileSpy = t.mock.method(sourceCache, 'getTile');
    const retained = sourceCache._updateRetainedTiles([idealTile], 2);

    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [],
      "doesn't request parent tiles bc they are lower than minzoom"
    );

    t.assert.deepEqual(
      retained,
      {
        // ideal tile id (2, 0, 0)
        2: new OverscaledTileID(2, 0, 2, 0, 0)
      },
      "doesn't retain parent tiles below minzoom"
    );
  });

  await t.test('use overzoomed tile above maxzoom', t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      },
      maxzoom: 2
    });
    const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);

    const getTileSpy = t.mock.method(sourceCache, 'getTile');
    const retained = sourceCache._updateRetainedTiles([idealTile], 2);

    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // overzoomed child
        new OverscaledTileID(3, 0, 2, 0, 0),
        // parents
        new OverscaledTileID(1, 0, 1, 0, 0),
        new OverscaledTileID(0, 0, 0, 0, 0)
      ],
      "doesn't request childtiles above maxzoom"
    );

    t.assert.deepEqual(
      retained,
      {
        // ideal tile id (2, 0, 0)
        2: new OverscaledTileID(2, 0, 2, 0, 0)
      },
      "doesn't retain child tiles above maxzoom"
    );
  });

  await t.test("dont't ascend multiple times if a tile is not found", t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      }
    });
    const idealTiles = [new OverscaledTileID(8, 0, 8, 0, 0), new OverscaledTileID(8, 0, 8, 1, 0)];

    const getTileSpy = t.mock.method(sourceCache, 'getTile');
    sourceCache._updateRetainedTiles(idealTiles, 8);
    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // parent tile ascent
        new OverscaledTileID(7, 0, 7, 0, 0),
        new OverscaledTileID(6, 0, 6, 0, 0),
        new OverscaledTileID(5, 0, 5, 0, 0),
        new OverscaledTileID(4, 0, 4, 0, 0),
        new OverscaledTileID(3, 0, 3, 0, 0),
        new OverscaledTileID(2, 0, 2, 0, 0),
        new OverscaledTileID(1, 0, 1, 0, 0),
        new OverscaledTileID(0, 0, 0, 0, 0)
      ],
      'only ascends up a tile pyramid once'
    );

    getTileSpy.mock.resetCalls();

    const loadedTiles = [new OverscaledTileID(4, 0, 4, 0, 0)];
    loadedTiles.forEach(t => {
      sourceCache._tiles[t.key] = new Tile(t);
      sourceCache._tiles[t.key].state = 'loaded';
    });

    sourceCache._updateRetainedTiles(idealTiles, 8);
    t.assert.deepEqual(
      getTileSpy.mock.calls.map(c => c.arguments[0]),
      [
        // parent tile ascent
        new OverscaledTileID(7, 0, 7, 0, 0),
        new OverscaledTileID(6, 0, 6, 0, 0),
        new OverscaledTileID(5, 0, 5, 0, 0),
        new OverscaledTileID(4, 0, 4, 0, 0) // tile is loaded, stops ascent
      ],
      'ascent stops if a loaded parent tile is found'
    );
  });

  await t.test('adds correct leaded parent tiles for overzoomed tiles', t => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loading';
        return Promise.resolve();
      },
      maxzoom: 7
    });
    const loadedTiles = [new OverscaledTileID(7, 0, 7, 0, 0), new OverscaledTileID(7, 0, 7, 1, 0)];
    loadedTiles.forEach(t => {
      sourceCache._tiles[t.key] = new Tile(t);
      sourceCache._tiles[t.key].state = 'loaded';
    });

    const idealTiles = [new OverscaledTileID(8, 0, 7, 0, 0), new OverscaledTileID(8, 0, 7, 1, 0)];
    const retained = sourceCache._updateRetainedTiles(idealTiles, 8);

    t.assert.deepEqual(Object.keys(retained), [
      new OverscaledTileID(7, 0, 7, 0, 0).key,
      new OverscaledTileID(8, 0, 7, 0, 0).key,
      new OverscaledTileID(7, 0, 7, 1, 0).key,
      new OverscaledTileID(8, 0, 7, 1, 0).key
    ]);
  });
});

test('SourceCache.clearTiles', async t => {
  await t.test('unloads tiles', t => {
    const coord = new OverscaledTileID(0, 0, 0, 0, 0);
    let abort = 0;
    let unload = 0;

    const sourceCache = createSourceCache({
      abortTile: function (tile) {
        t.assert.deepEqual(tile.tileID, coord);
        abort++;
      },
      unloadTile: function (tile) {
        t.assert.deepEqual(tile.tileID, coord);
        unload++;
      }
    });
    sourceCache.onAdd();

    sourceCache._addTile(coord);
    sourceCache.clearTiles();

    t.assert.equal(abort, 1);
    t.assert.equal(unload, 1);
  });
});

test('SourceCache.tilesIn', async t => {
  await t.test('graceful response before source loaded', t => {
    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    tr._calcMatrices();
    const sourceCache = createSourceCache({ noLoad: true });
    sourceCache.transform = tr;
    sourceCache.onAdd();
    t.assert.deepEqual(sourceCache.tilesIn([new Point(0, 0), new Point(512, 256)], 10, tr), []);
  });

  function round(queryGeometry) {
    return queryGeometry.map(p => {
      return p.round();
    });
  }
  await t.test('regular tiles', (t, done) => {
    const transform = new Transform();
    transform.resize(512, 512);
    transform.zoom = 1;
    transform.center = new LngLat(0, 1);

    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        tile.additionalRadius = 0;
        return Promise.resolve();
      }
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getIds(), [
          new OverscaledTileID(1, 0, 1, 1, 1).key,
          new OverscaledTileID(1, 0, 1, 0, 1).key,
          new OverscaledTileID(1, 0, 1, 1, 0).key,
          new OverscaledTileID(1, 0, 1, 0, 0).key
        ]);

        transform._calcMatrices();
        const tiles = sourceCache.tilesIn([new Point(0, 0), new Point(512, 256)], 1, transform);

        tiles.sort((a, b) => {
          return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x;
        });
        tiles.forEach(result => {
          delete result.tile.uid;
        });

        t.assert.equal(tiles[0].tile.tileID.key, 1);
        t.assert.equal(tiles[0].tile.tileSize, 512);
        t.assert.equal(tiles[0].scale, 1);
        t.assert.deepEqual(round(tiles[0].queryGeometry), [
          { x: 4096, y: 4050 },
          { x: 12288, y: 8146 }
        ]);

        t.assert.equal(tiles[1].tile.tileID.key, 33);
        t.assert.equal(tiles[1].tile.tileSize, 512);
        t.assert.equal(tiles[1].scale, 1);
        t.assert.deepEqual(round(tiles[1].queryGeometry), [
          { x: -4096, y: 4050 },
          { x: 4096, y: 8146 }
        ]);

        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('reparsed overscaled tiles', (t, done) => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        tile.additionalRadius = 0;
        return Promise.resolve();
      },
      reparseOverscaled: true,
      minzoom: 1,
      maxzoom: 1,
      tileSize: 512
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        const transform = new Transform();
        transform.resize(1024, 1024);
        transform.zoom = 2.0;
        transform.center = new LngLat(0, 1);
        sourceCache.update(transform);

        t.assert.deepEqual(sourceCache.getIds(), [
          new OverscaledTileID(2, 0, 2, 1, 1).key,
          new OverscaledTileID(2, 0, 2, 0, 1).key,
          new OverscaledTileID(2, 0, 2, 1, 0).key,
          new OverscaledTileID(2, 0, 2, 0, 0).key
        ]);

        const tiles = sourceCache.tilesIn([new Point(0, 0), new Point(1024, 512)], 1, transform);

        tiles.sort((a, b) => {
          return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x;
        });
        tiles.forEach(result => {
          delete result.tile.uid;
        });

        t.assert.equal(tiles[0].tile.tileID.key, 2);
        t.assert.equal(tiles[0].tile.tileSize, 1024);
        t.assert.equal(tiles[0].scale, 1);
        t.assert.deepEqual(round(tiles[0].queryGeometry), [
          { x: 4096, y: 4050 },
          { x: 12288, y: 8146 }
        ]);

        t.assert.equal(tiles[1].tile.tileID.key, 34);
        t.assert.equal(tiles[1].tile.tileSize, 1024);
        t.assert.equal(tiles[1].scale, 1);
        t.assert.deepEqual(round(tiles[1].queryGeometry), [
          { x: -4096, y: 4050 },
          { x: 4096, y: 8146 }
        ]);

        done();
      }
    });
    sourceCache.onAdd();
  });

  await t.test('overscaled tiles', (t, done) => {
    const sourceCache = createSourceCache({
      loadTile(tile) {
        tile.state = 'loaded';
        return Promise.resolve();
      },
      reparseOverscaled: false,
      minzoom: 1,
      maxzoom: 1,
      tileSize: 512
    });

    sourceCache.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        const transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 2.0;
        sourceCache.update(transform);

        done();
      }
    });
    sourceCache.onAdd();
  });
});

test('SourceCache.loaded (no errors)', (t, done) => {
  const sourceCache = createSourceCache({
    loadTile(tile) {
      tile.state = 'loaded';
      return Promise.resolve();
    }
  });

  sourceCache.on('data', e => {
    if (e.sourceDataType === 'metadata') {
      const coord = new OverscaledTileID(0, 0, 0, 0, 0);
      sourceCache._addTile(coord);

      t.assert.ok(sourceCache.loaded());
      done();
    }
  });
  sourceCache.onAdd();
});

test('SourceCache.loaded (with errors)', (t, done) => {
  const sourceCache = createSourceCache({
    loadTile() {
      return Promise.reject(new Error('An error occurred'));
    }
  });

  sourceCache.on('data', e => {
    if (e.sourceDataType === 'metadata') {
      const coord = new OverscaledTileID(0, 0, 0, 0, 0);
      sourceCache._addTile(coord);

      // HACK: wait for the next tick to ensure that the error is propagated
      process.nextTick(() => {
        t.assert.ok(sourceCache.loaded());
        done();
      });
    }
  });
  sourceCache.onAdd();
});

test('SourceCache.getIds (ascending order by zoom level)', t => {
  const ids = [
    new OverscaledTileID(0, 0, 0, 0, 0),
    new OverscaledTileID(3, 0, 3, 0, 0),
    new OverscaledTileID(1, 0, 1, 0, 0),
    new OverscaledTileID(2, 0, 2, 0, 0)
  ];

  const sourceCache = createSourceCache({});
  sourceCache.transform = new Transform();
  for (let i = 0; i < ids.length; i++) {
    sourceCache._tiles[ids[i].key] = { tileID: ids[i] };
  }
  t.assert.deepEqual(sourceCache.getIds(), [
    new OverscaledTileID(0, 0, 0, 0, 0).key,
    new OverscaledTileID(1, 0, 1, 0, 0).key,
    new OverscaledTileID(2, 0, 2, 0, 0).key,
    new OverscaledTileID(3, 0, 3, 0, 0).key
  ]);
  sourceCache.onAdd();
});

test('SourceCache.findLoadedParent', async t => {
  await t.test('adds from previously used tiles (sourceCache._tiles)', t => {
    const sourceCache = createSourceCache({});
    sourceCache.onAdd();
    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);

    const tile = {
      tileID: new OverscaledTileID(1, 0, 1, 0, 0),
      hasData: function () {
        return true;
      }
    };

    sourceCache._tiles[tile.tileID.key] = tile;

    t.assert.equal(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0), undefined);
    t.assert.deepEqual(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0), tile);
  });

  await t.test('retains parents', t => {
    const sourceCache = createSourceCache({});
    sourceCache.onAdd();
    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);

    const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512, 22);
    sourceCache._cache.add(tile);

    t.assert.equal(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0), undefined);
    t.assert.equal(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0), tile);
    t.assert.equal(sourceCache._cache.size, 1);
  });
});

test('SourceCache.reload', async t => {
  await t.test('before loaded', t => {
    const sourceCache = createSourceCache({ noLoad: true });
    sourceCache.onAdd();

    t.assert.doesNotThrow(
      () => {
        sourceCache.reload();
      },
      null,
      'reload ignored gracefully'
    );
  });
});

test('SourceCache sets max cache size correctly', async t => {
  await t.test('sets cache size based on 512 tiles', t => {
    const sourceCache = createSourceCache({
      tileSize: 256
    });

    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);

    // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 3 * 3 * 5
    t.assert.equal(sourceCache._cache.max, 45);
  });

  await t.test('sets cache size based on 256 tiles', t => {
    const sourceCache = createSourceCache({
      tileSize: 512
    });

    const tr = new Transform();
    tr.width = 512;
    tr.height = 512;
    sourceCache.updateCacheSize(tr);

    // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 2 * 2 * 5
    t.assert.equal(sourceCache._cache.max, 20);
  });
});
