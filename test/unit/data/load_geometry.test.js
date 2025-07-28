const test = require('node:test');
const fs = require('fs');
const path = require('path');
const Protobuf = require('@mapwhit/pbf');
const { VectorTile } = require('@mapwhit/vector-tile');
const loadGeometry = require('../../../src/data/load_geometry.js');

// Load a line feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
);

test('loadGeometry', t => {
  const feature = vt.layers.road.feature(0);
  const originalGeometry = feature.loadGeometry();
  const scaledGeometry = loadGeometry(feature);
  t.assert.equal(scaledGeometry[0][0].x, originalGeometry[0][0].x * 2, 'scales x coords by 2x');
  t.assert.equal(scaledGeometry[0][0].y, originalGeometry[0][0].y * 2, 'scales y coords by 2x');
});

test('loadGeometry extent error', t => {
  const feature = vt.layers.road.feature(0);
  feature.extent = 1024;

  const warn = t.mock.method(console, 'warn', () => {});
  loadGeometry(feature);
  t.assert.equal(warn.mock.callCount(), 1);
  t.assert.match(
    warn.mock.calls[0].arguments[0],
    /Geometry exceeds allowed extent, reduce your vector tile buffer size/
  );
});
