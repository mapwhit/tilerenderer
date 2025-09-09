import test from 'node:test';
import HeatmapStyleLayer from '../../../../src/style/style_layer/heatmap_style_layer.js';

test('HeatmapStyleLayer.queryIntersectsFeature', async t => {
  const feature = {};
  const featureState = {};
  const geometry = [
    [
      {
        x: 2634,
        y: 1059
      }
    ]
  ];
  const transform = {
    cameraToCenterDistance: 750
  };
  const pixelsToTileUnits = 16;
  const pixelPosMatrix = [
    46.875000938773155, 0, 0, 0, 0, -46.875, 0, 0, -0.00007950395956868306, -0.00007950395956868306,
    -0.00007971414743224159, -0.00007950395956868306, -255249.99197387695, 137676.37634277344, 749.9801635742188, 750
  ];

  await t.test('returns `true` when a heatmap intersects a point', t => {
    const heatmapLayer = new HeatmapStyleLayer({
      id: 'heatmap',
      type: 'heatmap',
      paint: {
        'heatmap-radius': 10
      }
    });
    heatmapLayer.recalculate({});
    const queryGeometry = [
      {
        x: 2685,
        y: 1081
      }
    ];

    const intersects = heatmapLayer.queryIntersectsFeature(
      queryGeometry,
      feature,
      featureState,
      geometry,
      15,
      transform,
      pixelsToTileUnits,
      pixelPosMatrix
    );
    t.assert.ok(intersects);
  });

  await t.test('returns `false` when a heatmap does not intersect a point', t => {
    const heatmapLayer = new HeatmapStyleLayer({
      id: 'heatmap',
      type: 'heatmap',
      paint: {
        'heatmap-radius': 10
      }
    });
    heatmapLayer.recalculate({});
    const queryGeometry = [
      {
        x: 2685,
        y: 1500
      }
    ];

    const intersects = heatmapLayer.queryIntersectsFeature(
      queryGeometry,
      feature,
      featureState,
      geometry,
      15,
      transform,
      pixelsToTileUnits,
      pixelPosMatrix
    );
    t.assert.ok(!intersects);
  });
});
