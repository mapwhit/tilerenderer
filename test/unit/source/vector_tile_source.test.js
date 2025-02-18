const { test } = require('../../util/mapbox-gl-js-test');
const _window = require('../../util/window');
const VectorTileSource = require('../../../src/source/vector_tile_source');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const { Evented } = require('../../../src/util/evented');

function createSource(options) {
  options.tiles = options.tiles ?? loadTile;
  const source = new VectorTileSource(
    'id',
    options,
    {
      send: function () {},
      broadcast: function () {}
    },
    options.eventedParent
  );
  source.onAdd({
    transform: { showCollisionBoxes: false }
  });

  source.on('error', e => {
    throw e.error;
  });

  return source;

  async function loadTile() {
    return { data: new ArrayBuffer(0) };
  }
}

test('VectorTileSource', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('can be constructed from TileJSON', (t, done) => {
    const source = createSource({
      minzoom: 1,
      maxzoom: 10,
      attribution: 'Mapbox'
    });

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        t.deepEqual(typeof source.tiles, 'function');
        t.deepEqual(source.minzoom, 1);
        t.deepEqual(source.maxzoom, 10);
        t.deepEqual(source.attribution, 'Mapbox');
        done();
      }
    });
  });

  await t.test('fires event with metadata property', (t, done) => {
    const source = createSource(require('../../fixtures/source'));
    source.on('data', e => {
      if (e.sourceDataType === 'content') {
        done();
      }
    });
  });

  await t.test('fires "dataloading" event', (t, done) => {
    const evented = new Evented();
    let dataloadingFired = false;
    evented.on('dataloading', () => {
      dataloadingFired = true;
    });
    const source = createSource(Object.assign({ eventedParent: evented }, require('../../fixtures/source')));
    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        if (!dataloadingFired) {
          t.fail();
        }
        done();
      }
    });
  });

  await t.test('serialize TileJSON', t => {
    async function loadTile() {
      return { data: new ArrayBuffer(0) };
    }

    const source = createSource({
      minzoom: 1,
      maxzoom: 10,
      attribution: 'Mapbox',
      tiles: loadTile
    });
    t.deepEqual(source.serialize(), {
      type: 'vector',
      minzoom: 1,
      maxzoom: 10,
      attribution: 'Mapbox',
      tiles: loadTile
    });
  });

  await t.test('reloads a loading tile properly', (t, done) => {
    const source = createSource({});
    const events = [];
    source.dispatcher.send = function (type, params, cb) {
      events.push(type);
      setTimeout(cb, 0);
      return 1;
    };

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        const tile = {
          tileID: new OverscaledTileID(10, 0, 10, 5, 5),
          state: 'loading',
          loadVectorData: function () {
            this.state = 'loaded';
            events.push('tileLoaded');
          },
          setExpiryData: function () {}
        };
        source.loadTile(tile, () => {});
        t.equal(tile.state, 'loading');
        source.loadTile(tile, () => {
          t.same(events, ['loadTile', 'tileLoaded', 'reloadTile', 'tileLoaded']);
          done();
        });
      }
    });
  });

  await t.test('respects TileJSON.bounds', (t, done) => {
    const source = createSource({
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Mapbox',
      bounds: [-47, -7, -45, -5]
    });
    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        t.false(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132)), 'returns false for tiles outside bounds');
        t.true(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132)), 'returns true for tiles inside bounds');
        done();
      }
    });
  });

  await t.test('does not error on invalid bounds', (t, done) => {
    const source = createSource({
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Mapbox',
      bounds: [-47, -7, -45, 91]
    });

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        t.deepEqual(
          source.tileBounds.bounds,
          { _sw: { lng: -47, lat: -7 }, _ne: { lng: -45, lat: 90 } },
          'converts invalid bounds to closest valid bounds'
        );
        done();
      }
    });
  });
});
