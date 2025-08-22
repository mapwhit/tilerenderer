const test = require('node:test');
const LngLat = require('../../../../src/geo/lng_lat');
const fixed = require('../../../util/mapbox-gl-js-test/fixed');
const fixedCoord = fixed.Coord;
const { createMap, initWindow } = require('../../../util/util');

test('queryRenderedFeatures', async t => {
  initWindow(t);

  await t.test('if no arguments provided', (t, done) => {
    createMap({}, (err, map) => {
      t.assert.ifError(err);
      t.mock.method(map.style, 'queryRenderedFeatures');

      const output = map.queryRenderedFeatures();

      const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
      t.assert.ok(args[0]);
      t.assert.deepEqual(args[1], {});
      t.assert.deepEqual(output, []);

      done();
    });
  });

  await t.test('if only "geometry" provided', (t, done) => {
    createMap({}, (err, map) => {
      t.assert.ifError(err);
      t.mock.method(map.style, 'queryRenderedFeatures');

      const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

      const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
      t.assert.deepEqual(
        args[0].worldCoordinate.map(c => fixedCoord(c)),
        [{ column: 0.5, row: 0.5, zoom: 0 }]
      ); // query geometry
      t.assert.deepEqual(args[1], {}); // params
      t.assert.deepEqual(args[2], map.transform); // transform
      t.assert.deepEqual(output, []);

      done();
    });
  });

  await t.test('if only "params" provided', (t, done) => {
    createMap({}, (err, map) => {
      t.assert.ifError(err);
      t.mock.method(map.style, 'queryRenderedFeatures');

      const output = map.queryRenderedFeatures({ filter: ['all'] });

      const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
      t.assert.ok(args[0]);
      t.assert.deepEqual(args[1], { filter: ['all'] });
      t.assert.deepEqual(output, []);

      done();
    });
  });

  await t.test('if both "geometry" and "params" provided', (t, done) => {
    createMap({}, (err, map) => {
      t.assert.ifError(err);
      t.mock.method(map.style, 'queryRenderedFeatures');

      const output = map.queryRenderedFeatures({ filter: ['all'] });

      const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
      t.assert.ok(args[0]);
      t.assert.deepEqual(args[1], { filter: ['all'] });
      t.assert.deepEqual(output, []);

      done();
    });
  });

  await t.test('queryRenderedFeatures returns empty array when geometry is outside map bounds', (t, done) => {
    createMap({}, (err, map) => {
      t.assert.ifError(err);
      t.mock.method(map.style, 'queryRenderedFeatures');

      map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

      const coords = map.style.queryRenderedFeatures.mock.calls[0].arguments[0].worldCoordinate.map(c => fixedCoord(c));
      t.assert.equal(coords[0].column, 1.5);
      t.assert.equal(coords[0].row, 0.5);
      t.assert.equal(coords[0].zoom, 0);

      done();
    });
  });

  await t.test('returns an empty array when no style is loaded', t => {
    const map = createMap({ style: undefined });
    t.assert.deepEqual(map.queryRenderedFeatures(), []);
  });
});
