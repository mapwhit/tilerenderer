const { test } = require('../../util/mapbox-gl-js-test');
const Wrapper = require('../../../src/source/geojson_wrapper');

test('geojsonwrapper', async t => {
  await t.test('linestring', async t => {
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

    t.ok(feature, 'gets a feature');
    t.deepEqual(feature.loadGeometry(), [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    ]);
    t.equal(feature.type, 2, 'type');
    t.deepEqual(feature.properties, { hello: 'world' }, 'properties');
  });

  await t.test('point', async t => {
    const features = [
      {
        type: 1,
        geometry: [[0, 1]],
        tags: {}
      }
    ];

    const wrap = new Wrapper(features);
    const feature = wrap.feature(0);
    t.deepEqual(feature.loadGeometry(), [[{ x: 0, y: 1 }]]);
  });
});
