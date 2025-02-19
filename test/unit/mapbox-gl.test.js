const { test } = require('../util/mapbox-gl-js-test');
const mapboxgl = require('../../src');

test('mapboxgl', async t => {
  await t.test('version', t => {
    t.ok(mapboxgl.version);
  });

  await t.test('workerCount', t => {
    t.ok(typeof mapboxgl.workerCount === 'number');
  });
});
