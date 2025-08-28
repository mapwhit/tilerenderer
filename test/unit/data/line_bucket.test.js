import test from 'node:test';
import Point from '@mapbox/point-geometry';
import LineBucket from '../../../src/data/bucket/line_bucket.js';
import segment from '../../../src/data/segment.js';
import LineStyleLayer from '../../../src/style/style_layer/line_style_layer.js';
import { createPopulateOptions, getFeaturesFromLayer, loadVectorTile } from '../../util/tile.js';

function createLine(numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    points.push(new Point(i / numPoints, i / numPoints));
  }
  return points;
}

function createLineBucket({ id, layout, paint, globalState }) {
  const layer = new LineStyleLayer({
    id,
    type: 'line',
    layout,
    paint
  });
  layer.recalculate({ zoom: 0, zoomHistory: {}, globalState });

  return new LineBucket({ layers: [layer], globalState });
}

test('LineBucket', async t => {
  let sourceLayer;
  t.before(() => {
    // Load line features from fixture tile.
    sourceLayer = loadVectorTile().layers.road;
  });

  await t.test('LineBucket', t => {
    t.assert.doesNotThrow(() => {
      const bucket = createLineBucket({ id: 'test' });

      const line = {
        type: 2,
        properties: {}
      };

      const polygon = {
        type: 3,
        properties: {}
      };

      bucket.addLine([new Point(0, 0)], line);

      bucket.addLine([new Point(0, 0)], polygon);

      bucket.addLine([new Point(0, 0), new Point(0, 0)], line);

      bucket.addLine([new Point(0, 0), new Point(0, 0)], polygon);

      bucket.addLine([new Point(0, 0), new Point(10, 10), new Point(0, 0)], line);

      bucket.addLine([new Point(0, 0), new Point(10, 10), new Point(0, 0)], polygon);

      bucket.addLine([new Point(0, 0), new Point(10, 10), new Point(10, 20)], line);

      bucket.addLine([new Point(0, 0), new Point(10, 10), new Point(10, 20)], polygon);

      bucket.addLine([new Point(0, 0), new Point(10, 10), new Point(10, 20), new Point(0, 0)], line);

      bucket.addLine([new Point(0, 0), new Point(10, 10), new Point(10, 20), new Point(0, 0)], polygon);

      const feature = sourceLayer.feature(0);
      bucket.addFeature(feature, feature.loadGeometry());
    });
  });

  await t.test('LineBucket segmentation', t => {
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

    const warn = t.mock.method(console, 'warn');

    const bucket = createLineBucket({ id: 'test' });

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature({}, [createLine(10)]);

    // add a feature that will break across the group boundary
    bucket.addFeature({}, [createLine(128)]);

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    t.assert.equal(bucket.layoutVertexArray.length, 276);
    t.assert.deepEqual(bucket.segments.get(), [
      {
        vertexOffset: 0,
        vertexLength: 20,
        primitiveOffset: 0,
        primitiveLength: 18
      },
      {
        vertexOffset: 20,
        vertexLength: 256,
        primitiveOffset: 18,
        primitiveLength: 254
      }
    ]);

    t.assert.equal(warn.mock.callCount(), 1);
  });

  await t.test('LineBucket line-pattern with global-state', t => {
    const bucket = createLineBucket({
      id: 'test',
      paint: { 'line-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] },
      globalState: { pattern: 'test-pattern' }
    });

    bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions());

    t.assert.ok(bucket.features.length > 0);
    t.assert.deepEqual(bucket.features[0].patterns, {
      test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
    });
  });
});
