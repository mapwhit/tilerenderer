import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import loadGeometry from '../../../src/data/load_geometry.js';

// Load a line feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(import.meta.dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
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
