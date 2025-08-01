const test = require('node:test');
const fs = require('fs');
const path = require('path');
const Protobuf = require('@mapwhit/pbf');
const { VectorTile } = require('@mapwhit/vector-tile');
const { default: Point } = require('@mapbox/point-geometry');
const segment = require('../../../src/data/segment');
const FillBucket = require('../../../src/data/bucket/fill_bucket');
const FillStyleLayer = require('../../../src/style/style_layer/fill_style_layer');

// Load a fill feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
);
const feature = vt.layers.water.feature(0);

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

test('FillBucket', t => {
  const layer = new FillStyleLayer({ id: 'test', type: 'fill', layout: {} });
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  const bucket = new FillBucket({ layers: [layer] });

  bucket.addFeature({}, [[new Point(0, 0), new Point(10, 10)]]);

  bucket.addFeature({}, [[new Point(0, 0), new Point(10, 10), new Point(10, 20)]]);

  bucket.addFeature(feature, feature.loadGeometry());
});

test('FillBucket segmentation', t => {
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

  const layer = new FillStyleLayer({
    id: 'test',
    type: 'fill',
    layout: {},
    paint: {
      'fill-color': ['to-color', ['get', 'foo'], '#000']
    }
  });
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  const bucket = new FillBucket({ layers: [layer] });

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
