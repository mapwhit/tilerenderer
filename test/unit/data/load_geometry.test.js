import test from 'node:test';
import loadGeometry from '../../../src/data/load_geometry.js';
import { loadVectorTile } from '../../util/tile.js';

test('loadGeometry', async t => {
  let sourceLayer;
  t.before(() => {
    // Load line features from fixture tile.
    sourceLayer = loadVectorTile().layers.road;
  });

  await t.test('loadGeometry', t => {
    const feature = sourceLayer.feature(0);
    const originalGeometry = feature.loadGeometry();
    const scaledGeometry = loadGeometry(feature);
    t.assert.equal(scaledGeometry[0][0].x, originalGeometry[0][0].x * 2, 'scales x coords by 2x');
    t.assert.equal(scaledGeometry[0][0].y, originalGeometry[0][0].y * 2, 'scales y coords by 2x');
  });

  await t.test('loadGeometry extent error', t => {
    const feature = sourceLayer.feature(0);
    feature.extent = 1024;

    const warn = t.mock.method(console, 'warn', () => {});
    loadGeometry(feature);
    t.assert.equal(warn.mock.callCount(), 1);
    t.assert.match(
      warn.mock.calls[0].arguments[0],
      /Geometry exceeds allowed extent, reduce your vector tile buffer size/
    );
  });
});
