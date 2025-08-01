const test = require('node:test');
const fs = require('fs');
const path = require('path');
const Protobuf = require('@mapwhit/pbf');
const { VectorTile } = require('@mapwhit/vector-tile');
const { default: Point } = require('@mapbox/point-geometry');
const segment = require('../../../src/data/segment');
const LineBucket = require('../../../src/data/bucket/line_bucket');
const LineStyleLayer = require('../../../src/style/style_layer/line_style_layer');

// Load a line feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
);
const feature = vt.layers.road.feature(0);

function createLine(numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    points.push(new Point(i / numPoints, i / numPoints));
  }
  return points;
}

test('LineBucket', t => {
  const layer = new LineStyleLayer({ id: 'test', type: 'line' });
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  const bucket = new LineBucket({ layers: [layer] });

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

  bucket.addFeature(feature, feature.loadGeometry());
});

test('LineBucket segmentation', t => {
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

  const layer = new LineStyleLayer({ id: 'test', type: 'line' });
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  const bucket = new LineBucket({ layers: [layer] });

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
