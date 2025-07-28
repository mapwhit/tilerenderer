const test = require('node:test');
const tileCover = require('../../../src/util/tile_cover');
const { OverscaledTileID } = require('../../../src/source/tile_id');

test('tileCover', async t => {
  await t.test('.cover', async t => {
    await t.test('calculates tile coverage at w = 0', t => {
      const z = 2;
      const coords = [
        { column: 0, row: 1, zoom: 2 },
        { column: 1, row: 1, zoom: 2 },
        { column: 1, row: 2, zoom: 2 },
        { column: 0, row: 2, zoom: 2 }
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1)]);
    });

    await t.test('calculates tile coverage at w > 0', t => {
      const z = 2;
      const coords = [
        { column: 12, row: 1, zoom: 2 },
        { column: 13, row: 1, zoom: 2 },
        { column: 13, row: 2, zoom: 2 },
        { column: 12, row: 2, zoom: 2 }
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 3, 2, 0, 1)]);
    });

    await t.test('calculates tile coverage at w = -1', t => {
      const z = 2;
      const coords = [
        { column: -1, row: 1, zoom: 2 },
        { column: 0, row: 1, zoom: 2 },
        { column: 0, row: 2, zoom: 2 },
        { column: -1, row: 2, zoom: 2 }
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, -1, 2, 3, 1)]);
    });

    await t.test('calculates tile coverage at w < -1', t => {
      const z = 2;
      const coords = [
        { column: -13, row: 1, zoom: 2 },
        { column: -12, row: 1, zoom: 2 },
        { column: -12, row: 2, zoom: 2 },
        { column: -13, row: 2, zoom: 2 }
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, -4, 2, 3, 1)]);
    });

    await t.test('calculates tile coverage across meridian', t => {
      const z = 2;
      const coords = [
        { column: -0.5, row: 1, zoom: 2 },
        { column: 0.5, row: 1, zoom: 2 },
        { column: 0.5, row: 2, zoom: 2 },
        { column: -0.5, row: 2, zoom: 2 }
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1), new OverscaledTileID(2, -1, 2, 3, 1)]);
    });

    await t.test('only includes tiles for a single world, if renderWorldCopies is set to false', t => {
      const z = 2;
      const coords = [
        { column: -0.5, row: 1, zoom: 2 },
        { column: 0.5, row: 1, zoom: 2 },
        { column: 0.5, row: 2, zoom: 2 },
        { column: -0.5, row: 2, zoom: 2 }
      ];
      const renderWorldCopies = false;
      const res = tileCover(z, coords, z, renderWorldCopies);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1)]);
    });
  });
});
