import test from 'node:test';
import Point from '@mapbox/point-geometry';
import FillExtrusionBucket from '../../../src/data/bucket/fill_extrusion_bucket.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import Wrapper from '../../../src/source/geojson_wrapper.js';
import { FillExtrusionStyleLayer } from '../../../src/style/style_layer/fill_extrusion_style_layer.js';

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

test('FillExtrusionBucket fill-pattern with global-state', t => {
  const globalState = { pattern: 'test-pattern' };
  const layer = new FillExtrusionStyleLayer({
    id: 'test',
    type: 'fill-extrusion',
    paint: { 'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] }
  });
  layer.recalculate({ zoom: 0, globalState });

  const bucket = new FillExtrusionBucket({ layers: [layer], globalState });

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
