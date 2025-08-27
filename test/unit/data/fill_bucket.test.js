import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Point from '@mapbox/point-geometry';
import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import FillBucket from '../../../src/data/bucket/fill_bucket.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import segment from '../../../src/data/segment.js';
import Wrapper from '../../../src/source/geojson_wrapper.js';
import FillStyleLayer from '../../../src/style/style_layer/fill_style_layer.js';

// Load a fill feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(import.meta.dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
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
  t.assert.doesNotThrow(() => {
    const layer = new FillStyleLayer({ id: 'test', type: 'fill', layout: {} });
    layer.recalculate({ zoom: 0, zoomHistory: {} });

    const bucket = new FillBucket({ layers: [layer] });

    bucket.addFeature({}, [[new Point(0, 0), new Point(10, 10)]]);

    bucket.addFeature({}, [[new Point(0, 0), new Point(10, 10), new Point(10, 20)]]);

    bucket.addFeature(feature, feature.loadGeometry());
  });
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

test('FillBucket fill-pattern with global-state', t => {
  const globalState = { pattern: 'test-pattern' };
  const layer = new FillStyleLayer({
    id: 'test',
    type: 'fill',
    paint: { 'fill-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] }
  });
  layer.recalculate({ zoom: 0, globalState });

  const bucket = new FillBucket({ layers: [layer], globalState });

  const wrapper = new Wrapper([
    {
      type: 3,
      geometry: [createPolygon(10)],
      tags: {}
    }
  ]);
  const features = new Array(wrapper.length);
  for (let i = 0; i < wrapper.length; i++) {
    features[i] = { feature: wrapper.feature(i) };
  }

  bucket.populate(features, { patternDependencies: {}, featureIndex: new FeatureIndex() });

  t.assert.equal(bucket.features.length, 1);
  t.assert.deepEqual(bucket.features[0].patterns, {
    test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
  });
});
