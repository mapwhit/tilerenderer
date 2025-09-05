import test from 'node:test';
import FillExtrusionBucket from '../../../src/data/bucket/fill_extrusion_bucket.js';
import { FillExtrusionStyleLayer } from '../../../src/style/style_layer/fill_extrusion_style_layer.js';
import { createPopulateOptions, getFeaturesFromLayer, loadVectorTile } from '../../util/tile.js';

function createFillExtrusionBucket({ id, layout, paint, globalState }) {
  const layer = new FillExtrusionStyleLayer(
    {
      id,
      type: 'fill-extrusion',
      layout,
      paint
    },
    globalState
  );
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  return new FillExtrusionBucket({ layers: [layer] });
}

test('FillExtrusionBucket', async t => {
  let sourceLayer;
  t.before(() => {
    // Load fill extrusion features from fixture tile.
    sourceLayer = loadVectorTile().layers.water;
  });

  await t.test('FillExtrusionBucket fill-pattern with global-state', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] },
      globalState: { pattern: 'test-pattern' }
    });

    bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions());

    t.assert.ok(bucket.features.length > 0);
    t.assert.deepEqual(bucket.features[0].patterns, {
      test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
    });
  });
});
