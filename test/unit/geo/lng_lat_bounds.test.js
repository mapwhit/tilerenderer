const { test } = require('../../util/mapbox-gl-js-test');
const LngLat = require('../../../src/geo/lng_lat');
const LngLatBounds = require('../../../src/geo/lng_lat_bounds');

test('LngLatBounds', async t => {
  await t.test('#constructor', async t => {
    const sw = new LngLat(0, 0);
    const ne = new LngLat(-10, 10);
    const bounds = new LngLatBounds(sw, ne);
    t.equal(bounds.getSouth(), 0);
    t.equal(bounds.getWest(), 0);
    t.equal(bounds.getNorth(), 10);
    t.equal(bounds.getEast(), -10);
  });

  await t.test('#constructor across dateline', async t => {
    const sw = new LngLat(170, 0);
    const ne = new LngLat(-170, 10);
    const bounds = new LngLatBounds(sw, ne);
    t.equal(bounds.getSouth(), 0);
    t.equal(bounds.getWest(), 170);
    t.equal(bounds.getNorth(), 10);
    t.equal(bounds.getEast(), -170);
  });

  await t.test('#constructor across pole', async t => {
    const sw = new LngLat(0, 85);
    const ne = new LngLat(-10, -85);
    const bounds = new LngLatBounds(sw, ne);
    t.equal(bounds.getSouth(), 85);
    t.equal(bounds.getWest(), 0);
    t.equal(bounds.getNorth(), -85);
    t.equal(bounds.getEast(), -10);
  });

  await t.test('#constructor no args', async t => {
    const bounds = new LngLatBounds();
    t.throws(() => {
      bounds.getCenter();
    });
  });

  await t.test('#extend with coordinate', async t => {
    const bounds = new LngLatBounds([0, 0], [10, 10]);
    bounds.extend([-10, -10]);

    t.equal(bounds.getSouth(), -10);
    t.equal(bounds.getWest(), -10);
    t.equal(bounds.getNorth(), 10);
    t.equal(bounds.getEast(), 10);

    bounds.extend(new LngLat(-15, -15));

    t.equal(bounds.getSouth(), -15);
    t.equal(bounds.getWest(), -15);
    t.equal(bounds.getNorth(), 10);
    t.equal(bounds.getEast(), 10);
  });

  await t.test('#extend with bounds', async t => {
    const bounds1 = new LngLatBounds([0, 0], [10, 10]);
    const bounds2 = new LngLatBounds([-10, -10], [10, 10]);
    bounds1.extend(bounds2);

    t.equal(bounds1.getSouth(), -10);
    t.equal(bounds1.getWest(), -10);
    t.equal(bounds1.getNorth(), 10);
    t.equal(bounds1.getEast(), 10);

    const bounds3 = [
      [-15, -15],
      [15, 15]
    ];
    bounds1.extend(bounds3);

    t.equal(bounds1.getSouth(), -15);
    t.equal(bounds1.getWest(), -15);
    t.equal(bounds1.getNorth(), 15);
    t.equal(bounds1.getEast(), 15);
  });

  await t.test('#extend with null', async t => {
    const bounds = new LngLatBounds([0, 0], [10, 10]);

    bounds.extend(null);

    t.equal(bounds.getSouth(), 0);
    t.equal(bounds.getWest(), 0);
    t.equal(bounds.getNorth(), 10);
    t.equal(bounds.getEast(), 10);
  });

  await t.test('#extend undefined bounding box', async t => {
    const bounds1 = new LngLatBounds(undefined, undefined);
    const bounds2 = new LngLatBounds([-10, -10], [10, 10]);

    bounds1.extend(bounds2);

    t.equal(bounds1.getSouth(), -10);
    t.equal(bounds1.getWest(), -10);
    t.equal(bounds1.getNorth(), 10);
    t.equal(bounds1.getEast(), 10);
  });

  await t.test('#extend same LngLat instance', async t => {
    const point = new LngLat(0, 0);
    const bounds = new LngLatBounds(point, point);

    bounds.extend(new LngLat(15, 15));

    t.equal(bounds.getSouth(), 0);
    t.equal(bounds.getWest(), 0);
    t.equal(bounds.getNorth(), 15);
    t.equal(bounds.getEast(), 15);
  });

  await t.test('accessors', async t => {
    const sw = new LngLat(0, 0);
    const ne = new LngLat(-10, -20);
    const bounds = new LngLatBounds(sw, ne);
    t.deepEqual(bounds.getCenter(), new LngLat(-5, -10));
    t.equal(bounds.getSouth(), 0);
    t.equal(bounds.getWest(), 0);
    t.equal(bounds.getNorth(), -20);
    t.equal(bounds.getEast(), -10);
    t.deepEqual(bounds.getSouthWest(), new LngLat(0, 0));
    t.deepEqual(bounds.getSouthEast(), new LngLat(-10, 0));
    t.deepEqual(bounds.getNorthEast(), new LngLat(-10, -20));
    t.deepEqual(bounds.getNorthWest(), new LngLat(0, -20));
  });

  await t.test('#convert', async t => {
    const sw = new LngLat(0, 0);
    const ne = new LngLat(-10, 10);
    const bounds = new LngLatBounds(sw, ne);
    t.equal(LngLatBounds.convert(undefined), undefined);
    t.deepEqual(LngLatBounds.convert(bounds), bounds);
    t.deepEqual(LngLatBounds.convert([sw, ne]), bounds);
    t.deepEqual(
      LngLatBounds.convert([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]),
      bounds
    );
  });

  await t.test('#toArray', async t => {
    const llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
    t.deepEqual(llb.toArray(), [
      [-73.9876, 40.7661],
      [-73.9397, 40.8002]
    ]);
  });

  await t.test('#toString', async t => {
    const llb = new LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
    t.deepEqual(llb.toString(), 'LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))');
  });

  await t.test('#isEmpty', async t => {
    const nullBounds = new LngLatBounds();
    t.equal(nullBounds.isEmpty(), true);
    nullBounds.extend([-73.9876, 40.7661], [-73.9397, 40.8002]);
    t.equal(nullBounds.isEmpty(), false);
  });
});
