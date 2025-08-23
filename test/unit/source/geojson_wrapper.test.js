import test from 'node:test';
import Wrapper from '../../../src/source/geojson_wrapper.js';

test('geojsonwrapper', async t => {
  await t.test('linestring', t => {
    const features = [
      {
        type: 2,
        geometry: [
          [
            [0, 0],
            [10, 10]
          ]
        ],
        tags: { hello: 'world' }
      }
    ];

    const wrap = new Wrapper(features);
    const feature = wrap.feature(0);

    t.assert.ok(feature, 'gets a feature');
    t.assert.deepEqual(feature.loadGeometry(), [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    ]);
    t.assert.equal(feature.type, 2, 'type');
    t.assert.deepEqual(feature.properties, { hello: 'world' }, 'properties');
  });

  await t.test('point', t => {
    const features = [
      {
        type: 1,
        geometry: [[0, 1]],
        tags: {}
      }
    ];

    const wrap = new Wrapper(features);
    const feature = wrap.feature(0);
    t.assert.deepEqual(feature.loadGeometry(), [[{ x: 0, y: 1 }]]);
  });
});
