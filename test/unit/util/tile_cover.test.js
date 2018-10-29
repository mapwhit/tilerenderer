import test from 'node:test';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import tileCover from '../../../src/util/tile_cover.js';

test('tileCover', async t => {
  await t.test('.cover', async t => {
    await t.test('calculates tile coverage at w = 0', t => {
      const z = 2;
      const coords = [
        new MercatorCoordinate(0, 0.25),
        new MercatorCoordinate(0.25, 0.25),
        new MercatorCoordinate(0.25, 0.5),
        new MercatorCoordinate(0, 0.5)
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1)]);
    });

    await t.test('calculates tile coverage at w > 0', t => {
      const z = 2;
      const coords = [
        new MercatorCoordinate(3, 0.25),
        new MercatorCoordinate(3.25, 0.25),
        new MercatorCoordinate(3.25, 0.5),
        new MercatorCoordinate(3, 0.5)
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 3, 2, 0, 1)]);
    });

    await t.test('calculates tile coverage at w = -1', t => {
      const z = 2;
      const coords = [
        new MercatorCoordinate(-0.25, 0.25),
        new MercatorCoordinate(0, 0.25),
        new MercatorCoordinate(0, 0.5),
        new MercatorCoordinate(-0.25, 0.5)
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, -1, 2, 3, 1)]);
    });

    await t.test('calculates tile coverage at w < -1', t => {
      const z = 2;
      const coords = [
        new MercatorCoordinate(-3.25, 0.25),
        new MercatorCoordinate(-3, 0.25),
        new MercatorCoordinate(-3, 0.5),
        new MercatorCoordinate(-3.25, 0.5)
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, -4, 2, 3, 1)]);
    });

    await t.test('calculates tile coverage across meridian', t => {
      const z = 2;
      const coords = [
        new MercatorCoordinate(-0.125, 0.25),
        new MercatorCoordinate(0.125, 0.25),
        new MercatorCoordinate(0.125, 0.5),
        new MercatorCoordinate(-0.125, 0.5)
      ];
      const res = tileCover(z, coords, z);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1), new OverscaledTileID(2, -1, 2, 3, 1)]);
    });

    await t.test('only includes tiles for a single world, if renderWorldCopies is set to false', t => {
      const z = 2;
      const coords = [
        new MercatorCoordinate(-0.125, 0.25),
        new MercatorCoordinate(0.125, 0.25),
        new MercatorCoordinate(0.125, 0.5),
        new MercatorCoordinate(-0.125, 0.5)
      ];
      const renderWorldCopies = false;
      const res = tileCover(z, coords, z, renderWorldCopies);
      t.assert.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1)]);
    });
  });
});
