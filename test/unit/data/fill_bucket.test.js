import test from 'node:test';
import { Point } from '@mapwhit/point-geometry';
import FillBucket from '../../../src/data/bucket/fill_bucket.js';
import segment from '../../../src/data/segment.js';
import FillStyleLayer from '../../../src/style/style_layer/fill_style_layer.js';
import { createPopulateOptions, getFeaturesFromLayer, loadVectorTile } from '../../util/tile.js';

function createPolygon(numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    points.push(
      new Point(
        2048 + 256 * Math.cos((i / numPoints) * 2 * Math.PI, 2048 + 256 * Math.sin((i / numPoints) * 2 * Math.PI))
      )
    );
  }
  return points;
}

function createFillBucket({ id, layout, paint, globalState }) {
  const layer = new FillStyleLayer({ id, type: 'fill', layout, paint }, globalState);
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  return new FillBucket({ layers: [layer] });
}

test('FillBucket', async t => {
  let sourceLayer;
  t.before(() => {
    // Load fill features from fixture tile.
    sourceLayer = loadVectorTile().layers.water;
  });

  await t.test('FillBucket', t => {
    t.assert.doesNotThrow(() => {
      const bucket = createFillBucket({ id: 'test', layout: {} });

      bucket.addFeature({}, [[new Point(0, 0), new Point(10, 10)]]);

      bucket.addFeature({}, [[new Point(0, 0), new Point(10, 10), new Point(10, 20)]]);

      const feature = sourceLayer.feature(0);
      bucket.addFeature(feature, feature.loadGeometry());
    });
  });

  await t.test('FillBucket segmentation', t => {
    // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    let _MAX_VERTEX_ARRAY_LENGTH;
    t.before(() => {
      _MAX_VERTEX_ARRAY_LENGTH = segment.MAX_GLYPHS;
      segment.MAX_VERTEX_ARRAY_LENGTH = 256;
    });
    t.after(() => {
      segment.MAX_VERTEX_ARRAY_LENGTH = _MAX_VERTEX_ARRAY_LENGTH;
    });

    const bucket = createFillBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-color': ['to-color', ['get', 'foo'], '#000'] }
    });

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature({}, [createPolygon(10)]);

    // add a feature that will break across the group boundary
    bucket.addFeature({}, [createPolygon(128), createPolygon(128)]);

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    t.assert.equal(bucket.layoutVertexArray.length, 266);
    t.assert.deepEqual(bucket.segments.get()[0], {
      vertexOffset: 0,
      vertexLength: 138,
      primitiveOffset: 0,
      primitiveLength: 134
    });
    t.assert.deepEqual(bucket.segments.get()[1], {
      vertexOffset: 138,
      vertexLength: 128,
      primitiveOffset: 134,
      primitiveLength: 126
    });
  });

  await t.test('FillBucket fill-pattern with global-state', t => {
    const bucket = createFillBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] },
      globalState: { pattern: 'test-pattern' }
    });

    bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions());

    t.assert.ok(bucket.features.length > 0);
    t.assert.deepEqual(bucket.features[0].patterns, {
      test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
    });
  });
});
