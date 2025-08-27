import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import FillExtrusionBucket from '../../../src/data/bucket/fill_extrusion_bucket.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import { FillExtrusionStyleLayer } from '../../../src/style/style_layer/fill_extrusion_style_layer.js';

// Load a fill feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(import.meta.dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
);

test('FillExtrusionBucket fill-pattern with global-state', t => {
  const globalState = { pattern: 'test-pattern' };
  const layer = new FillExtrusionStyleLayer({
    id: 'test',
    type: 'fill-extrusion',
    paint: { 'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] }
  });
  layer.recalculate({ zoom: 0, globalState });

  const bucket = new FillExtrusionBucket({ layers: [layer], globalState });

  const sourceLayer = vt.layers.water;
  const features = new Array(sourceLayer.length);
  for (let i = 0; i < sourceLayer.length; i++) {
    features[i] = { feature: sourceLayer.feature(i) };
  }

  bucket.populate(features, { patternDependencies: {}, featureIndex: new FeatureIndex() });

  t.assert.ok(bucket.features.length > 0);
  t.assert.deepEqual(bucket.features[0].patterns, {
    test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
  });
});
