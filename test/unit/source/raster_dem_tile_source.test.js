const { test } = require('mapbox-gl-js-test');
const RasterDEMTileSource = require('../../../src/source/raster_dem_tile_source');
const { OverscaledTileID } = require('../../../src/source/tile_id');

function createSource(options) {
  options.tiles = options.tiles ?? loadTile;
  const source = new RasterDEMTileSource('id', options, { send: function () {} }, options.eventedParent);
  source.onAdd({
    transform: { angle: 0, pitch: 0, showCollisionBoxes: false }
  });

  source.on('error', e => {
    throw e.error;
  });

  return source;

  async function loadTile() {
    return;
  }
}

test('RasterTileSource', async t => {
  await t.test('populates neighboringTiles', (t, done) => {
    const source = createSource({
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Mapbox'
    });
    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        const tile = {
          tileID: new OverscaledTileID(10, 0, 10, 5, 5),
          state: 'loading',
          loadVectorData: function () {},
          setExpiryData: function () {}
        };
        source.loadTile(tile, () => {
          t.deepEqual(Object.keys(tile.neighboringTiles), [
            new OverscaledTileID(10, 0, 10, 4, 4).key,
            new OverscaledTileID(10, 0, 10, 5, 4).key,
            new OverscaledTileID(10, 0, 10, 6, 4).key,
            new OverscaledTileID(10, 0, 10, 4, 5).key,
            new OverscaledTileID(10, 0, 10, 6, 5).key,
            new OverscaledTileID(10, 0, 10, 4, 6).key,
            new OverscaledTileID(10, 0, 10, 5, 6).key,
            new OverscaledTileID(10, 0, 10, 6, 6).key
          ]);

          done();
        });
      }
    });
  });

  await t.test('populates neighboringTiles with wrapped tiles', (t, done) => {
    const source = createSource({
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Mapbox'
    });
    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        const tile = {
          tileID: new OverscaledTileID(5, 0, 5, 31, 5),
          state: 'loading',
          loadVectorData: function () {},
          setExpiryData: function () {}
        };
        source.loadTile(tile, () => {
          t.deepEqual(Object.keys(tile.neighboringTiles), [
            new OverscaledTileID(5, 0, 5, 30, 4).key,
            new OverscaledTileID(5, 0, 5, 31, 4).key,
            new OverscaledTileID(5, 0, 5, 30, 5).key,
            new OverscaledTileID(5, 0, 5, 30, 6).key,
            new OverscaledTileID(5, 0, 5, 31, 6).key,
            new OverscaledTileID(5, 1, 5, 0, 4).key,
            new OverscaledTileID(5, 1, 5, 0, 5).key,
            new OverscaledTileID(5, 1, 5, 0, 6).key
          ]);
          done();
        });
      }
    });
  });
});
