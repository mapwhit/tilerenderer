const test = require('node:test');
const _window = require('../../util/window');
const { Evented } = require('@mapwhit/events');
const Transform = require('../../../src/geo/transform');
const Style = require('../../../src/style/style');
const { properties, serialize } = require('../../util/serialize_style');

function createStyleJSON(properties) {
  return Object.assign(
    {
      version: 8,
      sources: {},
      layers: []
    },
    properties
  );
}

class StubMap extends Evented {
  constructor() {
    super();
    this.transform = new Transform();
  }
}

test('Style.serialize', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('GeoJSONSource.serialize', async t => {
    const hawkHill = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [-122.48369693756104, 37.83381888486939],
              [-122.48356819152832, 37.82954808664175],
              [-122.48987674713133, 37.83263257682617],
              [-122.49378204345702, 37.83368330777276]
            ]
          }
        }
      ]
    };
    let style;
    t.beforeEach(() => {
      style = new Style(new StubMap());
      style._properties = properties;
    });
    t.afterEach(() => {
      style._remove();
    });
    await t.test('serialize source with inline data', (t, done) => {
      style.on('style.load', () => {
        style.addSource('id', {
          type: 'geojson',
          data: hawkHill
        });
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [],
          sources: {
            id: {
              type: 'geojson',
              data: hawkHill
            }
          }
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });

    await t.test('serialize source with url', (t, done) => {
      style.on('style.load', () => {
        style.addSource('id', {
          type: 'geojson',
          data: 'local://data.json'
        });
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [],
          sources: {
            id: {
              type: 'geojson',
              data: 'local://data.json'
            }
          }
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });

    await t.test('serialize source with updated data', (t, done) => {
      style.on('style.load', () => {
        style.addSource('id', {
          type: 'geojson',
          data: {}
        });
        style.setGeoJSONSourceData('id', hawkHill);
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [],
          sources: {
            id: {
              type: 'geojson',
              data: hawkHill
            }
          }
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });

    await t.test('serialize source with additional options', (t, done) => {
      style.on('style.load', () => {
        style.addSource('id', {
          type: 'geojson',
          data: {},
          cluster: true
        });
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [],
          sources: {
            id: {
              type: 'geojson',
              cluster: true
            }
          }
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });
  });

  await t.test('ImageSource.serialize', async t => {
    let style;
    t.beforeEach(() => {
      style = new Style(new StubMap());
    });
    t.afterEach(() => {
      style._remove();
    });
    await t.test('serialize url and coordinates', (t, done) => {
      style.on('style.load', () => {
        const url = new ArrayBuffer(0);
        const coordinates = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1]
        ];
        style.addSource('id', {
          type: 'image',
          url,
          coordinates
        });
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [],
          sources: {
            id: {
              type: 'image',
              url,
              coordinates
            }
          }
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });
  });

  await t.test('VectorTileSource.serialize', async t => {
    let style;
    t.beforeEach(() => {
      style = new Style(new StubMap());
    });
    t.afterEach(() => {
      style._remove();
    });

    await t.test('serialize TileJSON', (t, done) => {
      style.on('style.load', () => {
        style.addSource('id', {
          type: 'vector',
          minzoom: 1,
          maxzoom: 10,
          attribution: 'Open Street Map',
          tiles: ['https://example.com/{z}/{x}/{y}.pbf']
        });
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [],
          sources: {
            id: {
              type: 'vector',
              minzoom: 1,
              maxzoom: 10,
              attribution: 'Open Street Map',
              tiles: ['https://example.com/{z}/{x}/{y}.pbf']
            }
          }
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });
  });

  await t.test('StyleLayer.serialize', async t => {
    function createSymbolLayer(layer) {
      return Object.assign(
        {
          id: 'symbol',
          type: 'symbol',
          paint: {
            'text-color': 'blue'
          },
          layout: {
            'text-transform': 'uppercase'
          }
        },
        layer
      );
    }
    let style;
    t.beforeEach(() => {
      style = new Style(new StubMap());
    });
    t.afterEach(() => {
      style._remove();
    });

    await t.test('serializes layers', (t, done) => {
      style.on('style.load', () => {
        style.addLayer(createSymbolLayer());
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [createSymbolLayer()],
          sources: {}
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });

    await t.test('serializes functions', (t, done) => {
      const layerPaint = {
        'text-color': {
          base: 2,
          stops: [
            [0, 'red'],
            [1, 'blue']
          ]
        }
      };

      style.on('style.load', () => {
        style.addLayer(createSymbolLayer({ paint: layerPaint }));
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [createSymbolLayer({ paint: layerPaint })],
          sources: {}
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });

    await t.test('serializes added paint properties', (t, done) => {
      style.on('style.load', () => {
        style.addLayer(createSymbolLayer());
        style.setPaintProperty('symbol', 'text-halo-color', 'orange');
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [createSymbolLayer({ paint: { 'text-halo-color': 'orange', 'text-color': 'blue' } })],
          sources: {}
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });

    await t.test('serializes added layout properties', (t, done) => {
      style.on('style.load', () => {
        style.addLayer(createSymbolLayer());
        style.setLayoutProperty('symbol', 'text-size', 20);
        t.assert.deepEqual(serialize(style), {
          version: 8,
          layers: [
            createSymbolLayer({
              layout: {
                'text-size': 20,
                'text-transform': 'uppercase'
              }
            })
          ],
          sources: {}
        });
        done();
      });
      style.loadJSON(createStyleJSON());
    });
  });
});
