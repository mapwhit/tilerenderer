import test from 'node:test';
import LngLat from '../../../src/geo/lng_lat.js';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate.js';

test('LngLat', async t => {
  await t.test('#constructor', t => {
    t.assert.ok(new MercatorCoordinate(0, 0) instanceof MercatorCoordinate, 'creates an object');
    t.assert.ok(new MercatorCoordinate(0, 0, 0) instanceof MercatorCoordinate, 'creates an object with altitude');
  });

  await t.test('#fromLngLat', t => {
    const nullIsland = new LngLat(0, 0);
    t.assert.deepEqual(MercatorCoordinate.fromLngLat(nullIsland), { x: 0.5, y: 0.5, z: 0 });
  });

  await t.test('#toLngLat', t => {
    const dc = new LngLat(-77, 39);
    t.assert.deepEqual(MercatorCoordinate.fromLngLat(dc, 500).toLngLat(), { lng: -77, lat: 39 });
  });

  await t.test('#toAltitude', t => {
    const dc = new LngLat(-77, 39);
    t.assert.equal(MercatorCoordinate.fromLngLat(dc, 500).toAltitude(), 500);
  });
});
