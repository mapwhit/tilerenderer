import test from 'node:test';
import CircleStyleLayer from '../../../../src/style/style_layer/circle_style_layer.js';

test('CircleStyleLayer.queryIntersectsFeature', async t => {
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
    angle: 0,
    cameraToCenterDistance: 750
  };
  const pixelsToTileUnits = 16;
  const pixelPosMatrix = [
    46.875000938773155, 0, 0, 0, 0, -46.875, 0, 0, -0.00007950395956868306, -0.00007950395956868306,
    -0.00007971414743224159, -0.00007950395956868306, -255249.99197387695, 137676.37634277344, 749.9801635742188, 750
  ];

  await t.test('returns `true` when a circle intersects a point', t => {
    const circleLayer = new CircleStyleLayer({
      id: 'circle',
      type: 'circle',
      paint: {
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-translate': [0, 0],
        'circle-translate-anchor': 'map',
        'circle-pitch-scale': 'map',
        'circle-pitch-alignment': 'map'
      }
    });
    circleLayer.recalculate({});
    const queryGeometry = [
      {
        x: 2685,
        y: 1081
      }
    ];

    const intersects = circleLayer.queryIntersectsFeature(
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

  await t.test('returns `false` when a circle does not intersect a point', t => {
    const circleLayer = new CircleStyleLayer({
      id: 'circle',
      type: 'circle',
      paint: {
        'circle-radius': 10,
        'circle-stroke-width': 2,
        'circle-translate': [0, 0],
        'circle-translate-anchor': 'map',
        'circle-pitch-scale': 'map',
        'circle-pitch-alignment': 'map'
      }
    });
    circleLayer.recalculate({});
    const queryGeometry = [
      {
        x: 2000,
        y: 1081
      }
    ];

    const intersects = circleLayer.queryIntersectsFeature(
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
