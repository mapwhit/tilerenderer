const test = require('node:test');
const Map = require('../../../../src/ui/map');
const Tile = require('../../../../src/source/tile');
const { OverscaledTileID } = require('../../../../src/source/tile_id');
const fixed = require('../../../util/mapbox-gl-js-test/fixed');
const fixedLngLat = fixed.LngLat;
const { createMap, createStyleSource, createStyle, initWindow } = require('../../../util/util');

test('Map', async t => {
  initWindow(t);

  await t.test('constructor', t => {
    const map = createMap({ interactive: true, style: null });
    t.assert.ok(map.getContainer());
    t.assert.equal(map.getStyle(), undefined);
    t.assert.throws(
      () => {
        new Map({
          container: 'anElementIdWhichDoesNotExistInTheDocument'
        });
      },
      new Error("Container 'anElementIdWhichDoesNotExistInTheDocument' not found."),
      'throws on invalid map container id'
    );
  });

  await t.test('is_Loaded', async t => {
    await t.test('Map.isSourceLoaded', (t, done) => {
      const style = createStyle();
      createMap({ style: style }, (error, map) => {
        t.assert.ifError(error);
        map.on('data', e => {
          if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
            t.assert.equal(map.isSourceLoaded('geojson'), true, 'true when loaded');
            done();
          }
        });
        map.addSource('geojson', createStyleSource());
        t.assert.equal(map.isSourceLoaded('geojson'), false, 'false before loaded');
      });
    });

    await t.test('Map.isStyleLoaded', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });

      t.assert.equal(map.isStyleLoaded(), false, 'false before style has loaded');
      map.on('load', () => {
        t.assert.equal(map.isStyleLoaded(), true, 'true when style is loaded');
        done();
      });
    });

    await t.test('Map.areTilesLoaded', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });
      t.assert.equal(map.areTilesLoaded(), true, 'returns true if there are no sources on the map');
      map.on('load', () => {
        map.addSource('geojson', createStyleSource());
        map.style._sources.geojson._tiles.set('fakeTile', new Tile(new OverscaledTileID(0, 0, 0, 0, 0)));
        t.assert.equal(map.areTilesLoaded(), false, 'returns false if tiles are loading');
        map.style._sources.geojson._tiles.get('fakeTile').state = 'loaded';
        t.assert.equal(map.areTilesLoaded(), true, 'returns true if tiles are loaded');
        done();
      });
    });
  });

  await t.test('remove', t => {
    const map = createMap();
    t.assert.equal(map.getContainer().childNodes.length, 2);
    map.remove();
    t.assert.equal(map.getContainer().childNodes.length, 0);
  });

  await t.test('project', t => {
    const map = createMap();
    t.assert.deepEqual(map.project([0, 0]), { x: 100, y: 100 });
  });

  await t.test('unproject', t => {
    const map = createMap();
    t.assert.deepEqual(fixedLngLat(map.unproject([100, 100])), { lng: 0, lat: 0 });
  });
});
