const test = require('node:test');
const { properties, serialize } = require('../../util/serialize_style');

test('style properties', t => {
  t.assert.deepEqual(properties(), [
    'version',
    'name',
    'metadata',
    'center',
    'zoom',
    'bearing',
    'pitch',
    'state',
    'light',
    'sources',
    'sprite',
    'glyphs',
    'transition',
    'layers'
  ]);
});

test('serialize map stylesheet', async t => {
  await t.test('serialize empty styles', t => {
    t.assert.equal(serialize(), undefined);
    t.assert.throws(() => serialize({}));
    t.assert.throws(() =>
      serialize({
        layers: [],
        sources: {
          source_x: {}
        }
      })
    );
    t.assert.throws(() =>
      serialize({
        version: 8,
        sources: {
          source_x: {
            type: 'image'
          }
        }
      })
    );
  });

  await t.test('serialize minimal style', t => {
    t.assert.deepEqual(
      serialize({
        version: 8,
        layers: [],
        sources: {
          source_x: {
            type: 'vector'
          }
        }
      }),
      {
        version: 8,
        sources: {
          source_x: {
            type: 'vector'
          }
        },
        layers: []
      }
    );
  });

  await t.test('exclude random fields', t => {
    t.assert.deepEqual(
      serialize({
        version: 8,
        metadata: {
          random: 1
        },
        layers: [],
        random: 2,
        sources: {
          source_x: {
            type: 'raster',
            metadata: {
              random: 3
            },
            random: 4,
            _random: 5
          }
        }
      }),
      {
        version: 8,
        metadata: {
          random: 1
        },
        sources: {
          source_x: {
            type: 'raster',
            metadata: {
              random: 3
            },
            random: 4
          }
        },
        layers: []
      }
    );
  });

  await t.test('serializes style with geojson source and layers', t => {
    t.assert.deepEqual(
      serialize({
        version: 8,
        layers: [
          {
            id: 'background',
            type: 'background',
            layout: {},
            paint: {
              'background-color': 'red',
              'random-key': 'random-value'
            }
          },
          {
            id: 'symbol',
            type: 'symbol',
            source: 'geojson_source',
            layout: {
              'random-key': 'random-value'
            },
            paint: {
              'icon-color': 'red'
            }
          }
        ],
        sources: {
          geojson_source: {
            type: 'geojson',
            data: {
              type: 'Point',
              coordinates: [0, 0]
            }
          }
        }
      }),
      {
        version: 8,
        sources: {
          geojson_source: {
            type: 'geojson',
            data: {
              type: 'Point',
              coordinates: [0, 0]
            }
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': 'red'
            }
          },
          {
            id: 'symbol',
            type: 'symbol',
            source: 'geojson_source',
            paint: {
              'icon-color': 'red'
            }
          }
        ]
      }
    );
  });
});
