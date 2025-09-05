import test from 'node:test';
import { Event, Evented } from '@mapwhit/events';
import Transform from '../../../src/geo/transform.js';
import plugin from '../../../src/source/rtl_text_plugin.js';
import SourceCache from '../../../src/source/source_cache.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import Style from '../../../src/style/style.js';
import StyleLayer from '../../../src/style/style_layer.js';
import _window from '../../util/window.js';

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

function createSource() {
  return {
    type: 'vector',
    minzoom: 1,
    maxzoom: 10,
    attribution: 'Mapbox',
    tiles: []
  };
}

function createGeoJSONSource() {
  return {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  };
}

class StubMap extends Evented {
  constructor() {
    super();
    this.transform = new Transform();
  }
}

test('Style', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('Style', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('registers plugin listener', t => {
      plugin.clearRTLTextPlugin();

      t.mock.method(plugin, 'registerForPluginAvailability');

      style = new Style(new StubMap());
      t.assert.equal(plugin.registerForPluginAvailability.mock.callCount(), 1);

      t.mock.method(plugin, 'loadScript', () => Promise.reject());
      plugin.setRTLTextPlugin('some-bogus-url');
      t.assert.deepEqual(plugin.loadScript.mock.calls[0].arguments[0], 'https://example.org/some-bogus-url');
    });

    await t.test('loads plugin immediately if already registered', (t, done) => {
      plugin.clearRTLTextPlugin();
      t.mock.method(plugin, 'loadScript', () => Promise.reject(true));
      plugin.setRTLTextPlugin('some-bogus-url', error => {
        // Getting this error message shows the bogus URL was succesfully passed to the worker state
        t.assert.equal(error.message, 'RTL Text Plugin failed to load scripts from https://example.org/some-bogus-url');
        done();
      });
      style = new Style(createStyleJSON());
    });
  });

  await t.test('Style.loadJSON', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('fires "dataloading" (synchronously)', t => {
      style = new Style(new StubMap());
      const spy = t.mock.fn();

      style.on('dataloading', spy);
      style.loadJSON(createStyleJSON());

      t.assert.equal(spy.mock.callCount(), 1);
      t.assert.equal(spy.mock.calls[0].arguments[0].target, style);
      t.assert.equal(spy.mock.calls[0].arguments[0].dataType, 'style');
    });

    await t.test('fires "data" (asynchronously)', (t, done) => {
      style = new Style(new StubMap());

      style.loadJSON(createStyleJSON());

      style.on('data', e => {
        t.assert.equal(e.target, style);
        t.assert.equal(e.dataType, 'style');
        done();
      });
    });

    await t.test('fires "data" when the sprite finishes loading', (t, done) => {
      style = new Style(new StubMap());

      style.once('error', e => t.assert.ifError(e));

      style.once('data', e => {
        t.assert.equal(e.target, style);
        t.assert.equal(e.dataType, 'style');

        style.once('data', e => {
          t.assert.equal(e.target, style);
          t.assert.equal(e.dataType, 'style');
          done();
        });
      });

      style.loadJSON({
        version: 8,
        sources: {},
        layers: [],
        sprite: {
          json: {},
          image: new ArrayBuffer(0)
        }
      });
    });

    await t.test('creates sources', (t, done) => {
      style = new Style(new StubMap());

      style.on('style.load', () => {
        t.assert.ok(style._sources['mapbox'] instanceof SourceCache);
        done();
      });

      style.loadJSON(
        Object.assign(createStyleJSON(), {
          sources: {
            mapbox: {
              type: 'vector',
              tiles: []
            }
          }
        })
      );
    });

    await t.test('creates layers', (t, done) => {
      style = new Style(new StubMap());

      style.on('style.load', () => {
        t.assert.ok(style.getLayer('fill') instanceof StyleLayer);
        done();
      });

      style.loadJSON({
        version: 8,
        sources: {
          foo: {
            type: 'vector'
          }
        },
        layers: [
          {
            id: 'fill',
            source: 'foo',
            'source-layer': 'source-layer',
            type: 'fill'
          }
        ]
      });
    });

    await t.test('emits an error on non-existant vector source layer', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            '-source-id-': { type: 'vector', tiles: [] }
          },
          layers: []
        })
      );

      style.on('style.load', () => {
        style.removeSource('-source-id-');

        const source = createSource();
        source['vector_layers'] = [{ id: 'green' }];
        style.addSource('-source-id-', source);
        style.addLayer({
          id: '-layer-id-',
          type: 'circle',
          source: '-source-id-',
          'source-layer': '-source-layer-'
        });
        style.update({});
      });

      style.on('error', event => {
        const err = event.error;
        t.assert.ok(err);
        t.assert.ok(err.toString().indexOf('-source-layer-') !== -1);
        t.assert.ok(err.toString().indexOf('-source-id-') !== -1);
        t.assert.ok(err.toString().indexOf('-layer-id-') !== -1);

        done();
      });
    });

    await t.test('sets up layer event forwarding', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'background',
              type: 'background'
            }
          ]
        })
      );

      style.on('error', e => {
        t.assert.deepEqual(e.layer, { id: 'background' });
        t.assert.ok(e.mapbox);
        done();
      });

      style.on('style.load', () => {
        style._layers.get('background').fire(new Event('error', { mapbox: true }));
      });
    });

    await t.test('sets state if defined', (t, done) => {
      const map = new StubMap();
      style = new Style(map);
      style.loadJSON(
        createStyleJSON({
          state: {
            foo: {
              default: 'bar'
            }
          }
        })
      );

      style.on('style.load', () => {
        t.assert.deepEqual(style.getGlobalState(), { foo: 'bar' });
        done();
      });
    });

    await t.test('propagates global state object to layers', async t => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'layer-id',
              type: 'symbol',
              source: 'source-id',
              layout: {
                'text-size': ['global-state', 'size']
              }
            }
          ]
        })
      );
      await style.once('style.load');
      // tests that reference to globalState is propagated to layers
      // by setting globalState property and checking if the new value
      // was used when evaluating the layer
      const globalState = { size: { default: 12 } };
      style.setGlobalState(globalState);
      const layer = style.getLayer('layer-id');
      layer.recalculate({});
      t.assert.equal(layer._layout.get('text-size').evaluate({ zoom: 0 }), 12);
    });
  });

  await t.test('Style._remove', async t => {
    await t.test('clears tiles', (t, done) => {
      const style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: { 'source-id': createGeoJSONSource() }
        })
      );

      style.on('style.load', () => {
        const sourceCache = style._sources['source-id'];
        t.mock.method(sourceCache, 'clearTiles');
        style._remove();
        t.assert.equal(sourceCache.clearTiles.mock.callCount(), 1);
        done();
      });
    });

    await t.test('deregisters plugin listener', (t, done) => {
      const style = new Style(new StubMap());
      t.mock.method(style, '_reloadSources', () => {});
      style.loadJSON(createStyleJSON());
      t.mock.method(plugin, 'loadScript', () => {});

      style.on('style.load', () => {
        style._remove();
        plugin.setRTLTextPlugin('some-bogus-url');
        t.assert.equal(plugin.loadScript.mock.callCount(), 0);
        t.assert.equal(style._reloadSources.mock.callCount(), 0);
        done();
      });
    });
  });

  await t.test('Style.update', (t, done) => {
    const style = new Style(new StubMap());
    style.loadJSON({
      version: 8,
      sources: {
        source: {
          type: 'vector'
        }
      },
      layers: [
        {
          id: 'second',
          source: 'source',
          'source-layer': 'source-layer',
          type: 'fill'
        }
      ]
    });

    style.on('error', error => {
      t.assert.ifError(error);
    });

    t.mock.method(style, '_updateWorkerLayers', () => {
      t.assert.ok(style.getLayer('first'));
      t.assert.ok(style.getLayer('third'));
      t.assert.ok(!style.getLayer('second'));
      style._remove();
      done();
    });

    style.on('style.load', () => {
      style.addLayer({ id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer' }, 'second');
      style.addLayer({ id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer' });
      style.removeLayer('second');

      style.update({});
    });
  });

  await t.test('Style.addSource', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throw before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.addSource('source-id', createSource()), /load/i);
    });

    await t.test('throw if missing source type', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());

      const source = createSource();
      delete source.type;

      style.on('style.load', () => {
        t.assert.throws(() => style.addSource('source-id', source), /type/i);
        done();
      });
    });

    await t.test('fires "data" event', async () => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const source = createSource();
      const dataPromise = style.once('data');
      style.on('style.load', () => {
        style.addSource('source-id', source);
        style.update({});
      });
      await dataPromise;
    });

    await t.test('throws on duplicates', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const source = createSource();
      style.on('style.load', () => {
        style.addSource('source-id', source);
        t.assert.throws(() => {
          style.addSource('source-id', source);
        }, /There is already a source with this ID/);
        done();
      });
    });

    await t.test('sets up source event forwarding', { plan: 4 }, (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'background',
              type: 'background'
            }
          ]
        })
      );
      const source = createSource();

      style.on('style.load', () => {
        style.on('error', () => {
          t.assert.ok(true);
        });
        style.on('data', e => {
          if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
            t.assert.ok(true);
          } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
            t.assert.ok(true);
            done();
          } else {
            t.assert.ok(true);
          }
        });

        style.addSource('source-id', source); // fires data twice
        style._sources['source-id'].fire(new Event('error'));
        style._sources['source-id'].fire(new Event('data'));
      });
    });
  });

  await t.test('Style.removeSource', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throw before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.removeSource('source-id'), /load/i);
    });

    await t.test('fires "data" event', async () => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const source = createSource();
      const dataPromise = style.once('data');
      style.on('style.load', () => {
        style.addSource('source-id', source);
        style.removeSource('source-id');
        style.update({});
      });
      await dataPromise;
    });

    await t.test('clears tiles', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: { 'source-id': createGeoJSONSource() }
        })
      );

      style.on('style.load', () => {
        const sourceCache = style._sources['source-id'];
        t.mock.method(sourceCache, 'clearTiles');
        style.removeSource('source-id');
        t.assert.equal(sourceCache.clearTiles.mock.callCount(), 1);
        done();
      });
    });

    await t.test('throws on non-existence', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      style.on('style.load', () => {
        t.assert.throws(() => {
          style.removeSource('source-id');
        }, /There is no source with this ID/);
        done();
      });
    });

    function createStyle(callback) {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'mapbox-source': createGeoJSONSource()
          },
          layers: [
            {
              id: 'mapbox-layer',
              type: 'circle',
              source: 'mapbox-source',
              'source-layer': 'whatever'
            }
          ]
        })
      );
      style.on('style.load', () => {
        style.update({ zoom: 1, fadeDuration: 0 });
        callback(style);
      });
      return style;
    }

    await t.test('throws if source is in use', (t, done) => {
      createStyle(style => {
        style.on('error', event => {
          t.assert.ok(event.error.message.includes('"mapbox-source"'));
          t.assert.ok(event.error.message.includes('"mapbox-layer"'));
          done();
        });
        style.removeSource('mapbox-source');
      });
    });

    await t.test('does not throw if source is not in use', (t, done) => {
      createStyle(style => {
        style.on('error', () => {
          t.assert.fail();
        });
        style.removeLayer('mapbox-layer');
        style.removeSource('mapbox-source');
        done();
      });
    });

    await t.test('tears down source event forwarding', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      let source = createSource();

      style.on('style.load', () => {
        style.addSource('source-id', source);
        source = style._sources['source-id'];

        style.removeSource('source-id');

        // Suppress error reporting
        source.on('error', () => {});

        style.on('data', () => {
          t.assert.ok(false);
        });
        style.on('error', () => {
          t.assert.ok(false);
        });
        source.fire(new Event('data'));
        source.fire(new Event('error'));

        done();
      });
    });
  });

  await t.test('Style.setGeoJSONSourceData', async t => {
    const geoJSON = { type: 'FeatureCollection', features: [] };
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throws before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.setGeoJSONSourceData('source-id', geoJSON), /load/i);
    });

    await t.test('throws on non-existence', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      style.on('style.load', () => {
        t.assert.throws(() => style.setGeoJSONSourceData('source-id', geoJSON), /There is no source with this ID/);
        done();
      });
    });
  });

  await t.test('Style.setGlobalState', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throws before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.setGlobalState({}), /load/i);
    });

    await t.test('sets global state', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      style.on('style.load', () => {
        style.setGlobalState({ accentColor: { default: 'yellow' } });
        t.assert.deepEqual(style.getGlobalState(), { accentColor: 'yellow' });
        done();
      });
    });

    await t.test('reloads sources when state property is used in filter property', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'circle-source-id': createGeoJSONSource(),
            'fill-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'circle',
              source: 'circle-source-id',
              filter: ['global-state', 'showCircles']
            },
            {
              id: 'fourth-layer-id',
              type: 'fill',
              source: 'fill-source-id',
              filter: ['global-state', 'showFill']
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle-source-id'], 'resume');
        t.mock.method(style._sources['circle-source-id'], 'reload');
        t.mock.method(style._sources['fill-source-id'], 'resume');
        t.mock.method(style._sources['fill-source-id'], 'reload');

        style.setGlobalState({ showCircles: { default: true }, showFill: { default: false } });

        t.assert.ok(style._sources['circle-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['circle-source-id'].reload.mock.callCount() > 0);
        t.assert.ok(style._sources['fill-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['fill-source-id'].reload.mock.callCount() > 0);
        done();
      });
    });

    await t.test(
      'reloads sources when a new state property is used in a paint property that affects layout',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          createStyleJSON({
            sources: {
              'circle-source-id': createGeoJSONSource(),
              'fill-source-id': createGeoJSONSource()
            },
            layers: [
              {
                id: 'first-layer-id',
                type: 'circle',
                source: 'circle-source-id',
                paint: {
                  'circle-color': ['coalesce', ['get', 'color'], ['global-state', 'circleColor']]
                }
              }
            ]
          })
        );

        style.on('style.load', () => {
          t.mock.method(style._sources['circle-source-id'], 'resume');
          t.mock.method(style._sources['circle-source-id'], 'reload');

          style.setGlobalState({ circleColor: { default: 'red' } });
          style.update({
            globalState: style.getGlobalState()
          });

          t.assert.ok(style._sources['circle-source-id'].resume.mock.callCount() > 0);
          t.assert.ok(style._sources['circle-source-id'].reload.mock.callCount() > 0);
          done();
        });
      }
    );

    await t.test('reloads sources when state property is used in layout property', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'line-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'line',
              source: 'line-source-id',
              layout: {
                'line-join': ['global-state', 'lineJoin']
              }
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['line-source-id'], 'resume');
        t.mock.method(style._sources['line-source-id'], 'reload');

        style.setGlobalState({ lineJoin: { default: 'bevel' } });

        t.assert.ok(style._sources['line-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['line-source-id'].reload.mock.callCount() > 0);
        done();
      });
    });

    await t.test('does not reload sources when state property is set to the same value as current one', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          state: {
            showCircles: {
              default: true
            }
          },
          sources: {
            'circle-source-id': createGeoJSONSource(),
            'fill-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'circle',
              source: 'circle-source-id',
              filter: ['global-state', 'showCircles']
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle-source-id'], 'resume');
        t.mock.method(style._sources['circle-source-id'], 'reload');

        style.setGlobalState({ showCircles: { default: true } });
        style.update({
          globalState: style.getGlobalState()
        });

        t.assert.equal(style._sources['circle-source-id'].resume.mock.callCount(), 0);
        t.assert.equal(style._sources['circle-source-id'].reload.mock.callCount(), 0);
        done();
      });
    });

    await t.test('does not reload sources when new state property is used in paint property', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'circle-source-id': createGeoJSONSource(),
            'fill-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'circle',
              source: 'circle-source-id',
              paint: {
                'circle-color': ['global-state', 'circleColor']
              }
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle-source-id'], 'resume');
        t.mock.method(style._sources['circle-source-id'], 'reload');

        style.setGlobalState({ circleColor: { default: 'red' } });
        style.update({
          globalState: style.getGlobalState()
        });

        t.assert.equal(style._sources['circle-source-id'].resume.mock.callCount(), 0);
        t.assert.equal(style._sources['circle-source-id'].reload.mock.callCount(), 0);
        done();
      });
    });

    await t.test(
      'does not reload sources when new state property is used in paint property \
      while state property used in filter is unchanged',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          createStyleJSON({
            sources: {
              'circle-source-id': createGeoJSONSource()
            },
            layers: [
              {
                id: 'first-layer-id',
                type: 'circle',
                source: 'circle-source-id',
                filter: ['global-state', 'showFill'],
                paint: {
                  'circle-color': ['global-state', 'circleColor']
                }
              }
            ]
          })
        );

        style.on('style.load', () => {
          t.mock.method(style._sources['circle-source-id'], 'resume');
          t.mock.method(style._sources['circle-source-id'], 'reload');

          style.setGlobalState({ circleColor: { default: 'red' } });
          style.update({
            globalState: style.getGlobalState()
          });

          t.assert.equal(style._sources['circle-source-id'].resume.mock.callCount(), 0);
          t.assert.equal(style._sources['circle-source-id'].reload.mock.callCount(), 0);
          done();
        });
      }
    );

    await t.test(
      'does not reload sources when new state property is used in paint property \
      while state property used in layout is unchanged',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          createStyleJSON({
            state: {
              lineJoin: {
                default: 'bevel'
              }
            },
            sources: {
              'line-source-id': createGeoJSONSource()
            },
            layers: [
              {
                id: 'first-layer-id',
                type: 'line',
                source: 'line-source-id',
                layout: {
                  'line-join': ['global-state', 'lineJoin']
                },
                paint: {
                  'line-color': ['global-state', 'lineColor']
                }
              }
            ]
          })
        );

        style.on('style.load', () => {
          t.mock.method(style._sources['line-source-id'], 'resume');
          t.mock.method(style._sources['line-source-id'], 'reload');

          style.setGlobalState({ lineColor: { default: 'red' } });
          style.update({
            globalState: style.getGlobalState()
          });

          t.assert.equal(style._sources['line-source-id'].resume.mock.callCount(), 0);
          t.assert.equal(style._sources['line-source-id'].reload.mock.callCount(), 0);
          done();
        });
      }
    );
  });

  await t.test('Style.setGlobalStateProperty', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throws before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.setGlobalStateProperty('accentColor', 'yellow'), /load/i);
    });

    await t.test('sets property', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());

      style.on('style.load', () => {
        style.setGlobalStateProperty('accentColor', 'yellow');

        t.assert.deepEqual(style.getGlobalState(), { accentColor: 'yellow' });
        done();
      });
    });

    await t.test('sets property to default value when called with null', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          state: {
            accentColor: {
              default: 'blue'
            }
          }
        })
      );

      style.on('style.load', () => {
        style.setGlobalStateProperty('accentColor', 'yellow');
        t.assert.deepEqual(style.getGlobalState(), { accentColor: 'yellow' });
        style.setGlobalStateProperty('accentColor', null);
        t.assert.deepEqual(style.getGlobalState(), { accentColor: 'blue' });
        done();
      });
    });

    await t.test('reloads sources when state property is used in filter property', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'circle-1-source-id': createGeoJSONSource(),
            'circle-2-source-id': createGeoJSONSource(),
            'fill-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'circle',
              source: 'circle-1-source-id',
              filter: ['global-state', 'showCircles']
            },
            {
              id: 'second-layer-id',
              type: 'fill',
              source: 'fill-source-id'
            },
            {
              id: 'third-layer-id',
              type: 'circle',
              source: 'circle-2-source-id',
              filter: ['global-state', 'showCircles']
            },
            {
              id: 'fourth-layer-id',
              type: 'fill',
              source: 'fill-source-id',
              filter: ['global-state', 'showFill']
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle-1-source-id'], 'resume');
        t.mock.method(style._sources['circle-1-source-id'], 'reload');
        t.mock.method(style._sources['circle-2-source-id'], 'resume');
        t.mock.method(style._sources['circle-2-source-id'], 'reload');
        t.mock.method(style._sources['fill-source-id'], 'resume');
        t.mock.method(style._sources['fill-source-id'], 'reload');

        style.setGlobalStateProperty('showCircles', true);

        // The circle sources should be reloaded
        t.assert.ok(style._sources['circle-1-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['circle-1-source-id'].reload.mock.callCount() > 0);
        t.assert.ok(style._sources['circle-2-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['circle-2-source-id'].reload.mock.callCount() > 0);

        // The fill source should not be reloaded
        t.assert.equal(style._sources['fill-source-id'].resume.mock.callCount(), 0);
        t.assert.equal(style._sources['fill-source-id'].reload.mock.callCount(), 0);
        done();
      });
    });

    await t.test('reloads sources when state property is used in a paint property that affects layout', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'circle-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'layer-id',
              type: 'circle',
              source: 'circle-source-id',
              paint: {
                'circle-color': ['coalesce', ['get', 'color'], ['global-state', 'circleColor']]
              }
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle-source-id'], 'resume');
        t.mock.method(style._sources['circle-source-id'], 'reload');

        style.setGlobalStateProperty('circleColor', 'red');
        style.update({
          globalState: style.getGlobalState()
        });

        t.assert.ok(style._sources['circle-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['circle-source-id'].reload.mock.callCount() > 0);
        done();
      });
    });

    await t.test('reloads sources when state property is used in layout property', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'line-1-source-id': createGeoJSONSource(),
            'line-2-source-id': createGeoJSONSource(),
            'line-3-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'line',
              source: 'line-1-source-id',
              layout: {
                'line-join': ['global-state', 'lineJoin']
              }
            },
            {
              id: 'second-layer-id',
              type: 'line',
              source: 'line-3-source-id'
            },
            {
              id: 'third-layer-id',
              type: 'line',
              source: 'line-2-source-id',
              layout: {
                'line-join': ['global-state', 'lineJoin']
              }
            },
            {
              id: 'fourth-layer-id',
              type: 'line',
              source: 'line-3-source-id',
              layout: {
                'line-cap': ['global-state', 'lineCap']
              }
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['line-1-source-id'], 'resume');
        t.mock.method(style._sources['line-1-source-id'], 'reload');
        t.mock.method(style._sources['line-2-source-id'], 'resume');
        t.mock.method(style._sources['line-2-source-id'], 'reload');
        t.mock.method(style._sources['line-3-source-id'], 'resume');
        t.mock.method(style._sources['line-3-source-id'], 'reload');

        style.setGlobalStateProperty('lineJoin', 'bevel');

        // sources line-1 and line-2 should be reloaded
        t.assert.ok(style._sources['line-1-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['line-1-source-id'].reload.mock.callCount() > 0);
        t.assert.ok(style._sources['line-2-source-id'].resume.mock.callCount() > 0);
        t.assert.ok(style._sources['line-2-source-id'].reload.mock.callCount() > 0);
        // source line-3 should not be reloaded
        t.assert.equal(style._sources['line-3-source-id'].resume.mock.callCount(), 0);
        t.assert.equal(style._sources['line-3-source-id'].reload.mock.callCount(), 0);
        done();
      });
    });

    await t.test('does not reload sources when state property is set to the same value as current one', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          state: {
            showCircle: {
              default: true
            }
          },
          sources: {
            circle: createGeoJSONSource()
          },
          layers: [
            {
              id: 'first-layer-id',
              type: 'circle',
              source: 'circle',
              filter: ['global-state', 'showCircle']
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle'], 'resume');
        t.mock.method(style._sources['circle'], 'reload');

        style.setGlobalStateProperty('showCircle', true);
        style.update({
          globalState: style.getGlobalState()
        });

        t.assert.equal(style._sources['circle'].resume.mock.callCount(), 0);
        t.assert.equal(style._sources['circle'].reload.mock.callCount(), 0);
        done();
      });
    });

    await t.test('does not reload sources when state property is only used in paint properties', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            'circle-source-id': createGeoJSONSource()
          },
          layers: [
            {
              id: 'layer-id',
              type: 'circle',
              source: 'circle-source-id',
              paint: {
                'circle-color': ['global-state', 'circleColor']
              }
            }
          ]
        })
      );

      style.on('style.load', () => {
        t.mock.method(style._sources['circle-source-id'], 'resume');
        t.mock.method(style._sources['circle-source-id'], 'reload');

        style.setGlobalStateProperty('circleColor', 'red');
        style.update({
          globalState: style.getGlobalState()
        });

        t.assert.equal(style._sources['circle-source-id'].resume.mock.callCount(), 0);
        t.assert.equal(style._sources['circle-source-id'].reload.mock.callCount(), 0);
        done();
      });
    });

    await t.test(
      'does not reload sources when state property is used in paint property \
      while a different state property used in filter is unchanged',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          createStyleJSON({
            sources: {
              'circle-source-id': createGeoJSONSource()
            },
            layers: [
              {
                id: 'first-layer-id',
                type: 'circle',
                source: 'circle-source-id',
                filter: ['global-state', 'showFill'],
                paint: {
                  'circle-color': ['global-state', 'circleColor']
                }
              }
            ]
          })
        );

        style.on('style.load', () => {
          t.mock.method(style._sources['circle-source-id'], 'resume');
          t.mock.method(style._sources['circle-source-id'], 'reload');

          style.setGlobalStateProperty('circleColor', 'red');
          style.update({
            globalState: style.getGlobalState()
          });

          t.assert.equal(style._sources['circle-source-id'].resume.mock.callCount(), 0);
          t.assert.equal(style._sources['circle-source-id'].reload.mock.callCount(), 0);
          done();
        });
      }
    );

    await t.test(
      'does not reload sources when state property is used in paint property \
      while a different state property used in layout is unchanged',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          createStyleJSON({
            state: {
              lineJoin: {
                default: 'bevel'
              }
            },
            sources: {
              'line-source-id': createGeoJSONSource()
            },
            layers: [
              {
                id: 'first-layer-id',
                type: 'line',
                source: 'line-source-id',
                layout: {
                  'line-join': ['global-state', 'lineJoin']
                },
                paint: {
                  'line-color': ['global-state', 'lineColor']
                }
              }
            ]
          })
        );

        style.on('style.load', () => {
          t.mock.method(style._sources['line-source-id'], 'resume');
          t.mock.method(style._sources['line-source-id'], 'reload');

          style.setGlobalStateProperty('lineColor', 'red');
          style.update({
            globalState: style.getGlobalState()
          });

          t.assert.equal(style._sources['line-source-id'].resume.mock.callCount(), 0);
          t.assert.equal(style._sources['line-source-id'].reload.mock.callCount(), 0);
          done();
        });
      }
    );
  });

  await t.test('Style.addLayer', async t => {
    let style;
    const assertsOnDone = [];

    t.afterEach(() => {
      assertsOnDone.forEach(a => a());
      assertsOnDone.length = 0;
      style._remove();
    });

    await t.test('throw before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.addLayer({ id: 'background', type: 'background' }), /load/i);
    });

    await t.test('sets up layer event forwarding', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());

      style.on('error', e => {
        t.assert.deepEqual(e.layer, { id: 'background' });
        t.assert.ok(e.mapbox);
        done();
      });

      style.on('style.load', () => {
        style.addLayer({
          id: 'background',
          type: 'background'
        });
        style._layers.get('background').fire(new Event('error', { mapbox: true }));
      });
    });

    await t.test('throws on non-existant vector source layer', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: {
            // At least one source must be added to trigger the load event
            dummy: { type: 'vector', tiles: [] }
          }
        })
      );

      style.on('style.load', () => {
        const source = createSource();
        source['vector_layers'] = [{ id: 'green' }];
        style.addSource('-source-id-', source);
        style.addLayer({
          id: '-layer-id-',
          type: 'circle',
          source: '-source-id-',
          'source-layer': '-source-layer-'
        });
      });

      style.on('error', event => {
        const err = event.error;

        t.assert.ok(err);
        t.assert.ok(err.toString().indexOf('-source-layer-') !== -1);
        t.assert.ok(err.toString().indexOf('-source-id-') !== -1);
        t.assert.ok(err.toString().indexOf('-layer-id-') !== -1);

        done();
      });
    });

    await t.test('reloads source', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        Object.assign(createStyleJSON(), {
          sources: {
            mapbox: {
              type: 'vector',
              tiles: []
            }
          }
        })
      );
      const layer = {
        id: 'symbol',
        type: 'symbol',
        source: 'mapbox',
        'source-layer': 'boxmap',
        filter: ['==', 'id', 0]
      };

      style.on('data', e => {
        if (e.dataType === 'source' && e.sourceDataType === 'content') {
          style._sources['mapbox'].reload = done;
          style.addLayer(layer);
          style.update({});
        }
      });
    });

    await t.test(
      '#3895 reloads source (instead of clearing) if adding this layer with the same type, immediately after removing it',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          Object.assign(createStyleJSON(), {
            sources: {
              mapbox: {
                type: 'vector',
                tiles: []
              }
            },
            layers: [
              {
                id: 'my-layer',
                type: 'symbol',
                source: 'mapbox',
                'source-layer': 'boxmap',
                filter: ['==', 'id', 0]
              }
            ]
          })
        );

        const layer = {
          id: 'my-layer',
          type: 'symbol',
          source: 'mapbox',
          'source-layer': 'boxmap'
        };

        style.on('data', e => {
          if (e.dataType === 'source' && e.sourceDataType === 'content') {
            const sourceCache = style._sources['mapbox'];
            const { reload } = sourceCache;
            sourceCache.reload = () => {
              reload.call(sourceCache);
              sourceCache.reload = reload;
              done();
            };
            t.mock.method(sourceCache, 'clearTiles');
            assertsOnDone.push(() => {
              t.assert.equal(sourceCache.clearTiles.mock.callCount(), 0);
            });
            style.removeLayer('my-layer');
            style.addLayer(layer);
            style.update({});
          }
        });
      }
    );

    await t.test(
      'clears source (instead of reloading) if adding this layer with a different type, immediately after removing it',
      (t, done) => {
        style = new Style(new StubMap());
        style.loadJSON(
          Object.assign(createStyleJSON(), {
            sources: {
              mapbox: {
                type: 'vector',
                tiles: []
              }
            },
            layers: [
              {
                id: 'my-layer',
                type: 'symbol',
                source: 'mapbox',
                'source-layer': 'boxmap',
                filter: ['==', 'id', 0]
              }
            ]
          })
        );

        const layer = {
          id: 'my-layer',
          type: 'circle',
          source: 'mapbox',
          'source-layer': 'boxmap'
        };
        style.on('data', e => {
          if (e.dataType === 'source' && e.sourceDataType === 'content') {
            const sourceCache = style._sources['mapbox'];
            t.mock.method(sourceCache, 'reload');
            assertsOnDone.push(() => {
              t.assert.equal(sourceCache.reload.mock.callCount(), 0);
            });
            const { clearTiles } = sourceCache;
            sourceCache.clearTiles = () => {
              clearTiles.call(sourceCache);
              sourceCache.clearTiles = clearTiles;
              done();
            };
            style.removeLayer('my-layer');
            style.addLayer(layer);
            style.update({});
          }
        });
      }
    );

    await t.test('fires "data" event', async () => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      const dataPromise = style.once('data');
      style.on('style.load', () => {
        style.addLayer(layer);
        style.update({});
      });
      await dataPromise;
    });

    await t.test('emits error on duplicates', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      style.on('error', e => {
        t.assert.match(e.error.message, /already exists/);
        done();
      });

      style.on('style.load', () => {
        style.addLayer(layer);
        style.addLayer(layer);
      });
    });

    await t.test('adds to the end by default', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'a',
              type: 'background'
            },
            {
              id: 'b',
              type: 'background'
            }
          ]
        })
      );
      const layer = { id: 'c', type: 'background' };

      style.on('style.load', () => {
        style.addLayer(layer);
        t.assert.deepEqual(Array.from(style._layers.keys()), ['a', 'b', 'c']);
        done();
      });
    });

    await t.test('adds before the given layer', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'a',
              type: 'background'
            },
            {
              id: 'b',
              type: 'background'
            }
          ]
        })
      );
      const layer = { id: 'c', type: 'background' };

      style.on('style.load', () => {
        style.addLayer(layer, 'a');
        t.assert.deepEqual(Array.from(style._layers.keys()), ['c', 'a', 'b']);
        done();
      });
    });

    await t.test('fire error if before layer does not exist', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'a',
              type: 'background'
            },
            {
              id: 'b',
              type: 'background'
            }
          ]
        })
      );
      const layer = { id: 'c', type: 'background' };

      style.on('style.load', () => {
        style.on('error', error => {
          t.assert.match(error.error.message, /does not exist on this map/);
          done();
        });
        style.addLayer(layer, 'z');
      });
    });

    await t.test('fires an error on non-existant source layer', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        Object.assign(createStyleJSON(), {
          sources: {
            dummy: {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] }
            }
          }
        })
      );

      const layer = {
        id: 'dummy',
        type: 'fill',
        source: 'dummy',
        'source-layer': 'dummy'
      };

      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist on source/);
          done();
        });
        style.addLayer(layer);
      });
    });
  });

  await t.test('Style.removeLayer', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throw before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.removeLayer('background'), /load/i);
    });

    await t.test('fires "data" event', async () => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      const dataPromise = style.once('data');
      style.on('style.load', () => {
        style.addLayer(layer);
        style.removeLayer('background');
        style.update({});
      });
      await dataPromise;
    });

    await t.test('tears down layer event forwarding', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'background',
              type: 'background'
            }
          ]
        })
      );

      style.on('error', () => {
        t.assert.fail();
      });

      style.on('style.load', () => {
        const layer = style._layers.get('background');
        style.removeLayer('background');

        // Bind a listener to prevent fallback Evented error reporting.
        layer.on('error', () => {});

        layer.fire(new Event('error', { mapbox: true }));
        done();
      });
    });

    await t.test('fires an error on non-existence', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());

      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map's style and cannot be removed/);
          done();
        });
        style.removeLayer('background');
      });
    });

    await t.test('removes from the order', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          layers: [
            {
              id: 'a',
              type: 'background'
            },
            {
              id: 'b',
              type: 'background'
            }
          ]
        })
      );

      style.on('style.load', () => {
        style.removeLayer('a');
        t.assert.deepEqual(Array.from(style._layers.keys()), ['b']);
        done();
      });
    });
  });

  await t.test('Style.moveLayer', async t => {
    let style;

    t.beforeEach(() => {
      style = new Style(new StubMap());
    });

    t.afterEach(() => {
      style._remove();
      style = null;
    });

    await t.test('throw before loaded', t => {
      t.assert.throws(() => style.moveLayer('background'), /load/i);
    });

    await t.test('fires "data" event', async () => {
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      const dataPromise = style.once('data');
      style.on('style.load', () => {
        style.addLayer(layer);
        style.moveLayer('background');
        style.update({});
      });
      await dataPromise;
    });

    await t.test('fires an error on non-existence', (t, done) => {
      style.loadJSON(createStyleJSON());

      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map's style and cannot be moved/);
          done();
        });
        style.moveLayer('background');
      });
    });

    await t.test('changes the order', (t, done) => {
      style.loadJSON(
        createStyleJSON({
          layers: [
            { id: 'a', type: 'background' },
            { id: 'b', type: 'background' },
            { id: 'c', type: 'background' }
          ]
        })
      );

      style.on('style.load', () => {
        style.moveLayer('a', 'c');
        t.assert.deepEqual(Array.from(style._layers.keys()), ['b', 'a', 'c']);
        done();
      });
    });

    await t.test('moves to existing location', (t, done) => {
      style.loadJSON(
        createStyleJSON({
          layers: [
            { id: 'a', type: 'background' },
            { id: 'b', type: 'background' },
            { id: 'c', type: 'background' }
          ]
        })
      );

      style.on('style.load', () => {
        style.moveLayer('b', 'b');
        t.assert.deepEqual(Array.from(style._layers.keys()), ['a', 'b', 'c']);
        done();
      });
    });
  });

  await t.test('Style.setPaintProperty', async t => {
    let style;

    t.beforeEach(() => {
      style = new Style(new StubMap());
    });

    t.afterEach(() => {
      style._remove();
      style = null;
    });

    await t.test('#4738 postpones source reload until layers have been broadcast to workers', async t => {
      const { promise, resolve } = Promise.withResolvers();
      style.loadJSON(
        Object.assign(createStyleJSON(), {
          sources: {
            geojson: {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] }
            }
          },
          layers: [
            {
              id: 'circle',
              type: 'circle',
              source: 'geojson'
            }
          ]
        })
      );

      const tr = new Transform();
      tr.resize(512, 512);

      style.once('style.load', () => {
        style.update({ zoom: tr.zoom, fadeDuration: 0 });
        const sourceCache = style._sources['geojson'];
        const source = style.getSource('geojson');

        let begun = false;
        let styleUpdateCalled = false;

        t.mock.method(sourceCache, 'reload', () => {
          t.assert.ok(styleUpdateCalled, 'loadTile called before layer data broadcast');
          resolve();
        });

        source.on('data', e =>
          setImmediate(() => {
            if (!begun && sourceCache.loaded()) {
              begun = true;
              source.setData({ type: 'FeatureCollection', features: [] });
              style.setPaintProperty('circle', 'circle-color', { type: 'identity', property: 'foo' });
            }

            if (begun && e.sourceDataType === 'content') {
              // setData() worker-side work is complete; simulate an
              // animation frame a few ms later, so that this test can
              // confirm that SourceCache#reload() isn't called until
              // after the next Style#update()
              setTimeout(() => {
                styleUpdateCalled = true;
                style.update({});
              }, 50);
            }
          })
        );
      });
      await promise;
    });

    await t.test('#5802 clones the input', (t, done) => {
      style.loadJSON({
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background'
          }
        ]
      });

      style.on('style.load', () => {
        const value = {
          stops: [
            [0, 'red'],
            [10, 'blue']
          ]
        };
        style.setPaintProperty('background', 'background-color', value);
        t.assert.notEqual(style.getPaintProperty('background', 'background-color'), value);
        t.assert.ok(style._changed);

        style.update({});
        t.assert.ok(!style._changed);

        value.stops[0][0] = 1;
        style.setPaintProperty('background', 'background-color', value);
        t.assert.ok(style._changed);

        done();
      });
    });
  });

  await t.test('Style.getPaintProperty', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('#5802 clones the output', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background'
          }
        ]
      });

      style.on('style.load', () => {
        style.setPaintProperty('background', 'background-color', {
          stops: [
            [0, 'red'],
            [10, 'blue']
          ]
        });
        style.update({});
        t.assert.ok(!style._changed);

        const value = style.getPaintProperty('background', 'background-color');
        value.stops[0][0] = 1;
        style.setPaintProperty('background', 'background-color', value);
        t.assert.ok(style._changed);

        done();
      });
    });
  });

  await t.test('Style.setLayoutProperty', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('#5802 clones the input', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {
          geojson: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          }
        },
        layers: [
          {
            id: 'line',
            type: 'line',
            source: 'geojson'
          }
        ]
      });

      style.on('style.load', () => {
        const value = {
          stops: [
            [0, 'butt'],
            [10, 'round']
          ]
        };
        style.setLayoutProperty('line', 'line-cap', value);
        t.assert.notEqual(style.getLayoutProperty('line', 'line-cap'), value);
        t.assert.ok(style._changed);

        style.update({});
        t.assert.ok(!style._changed);

        value.stops[0][0] = 1;
        style.setLayoutProperty('line', 'line-cap', value);
        t.assert.ok(style._changed);

        done();
      });
    });
  });

  await t.test('Style.getLayoutProperty', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('#5802 clones the output', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {
          geojson: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          }
        },
        layers: [
          {
            id: 'line',
            type: 'line',
            source: 'geojson'
          }
        ]
      });

      style.on('style.load', () => {
        style.setLayoutProperty('line', 'line-cap', {
          stops: [
            [0, 'butt'],
            [10, 'round']
          ]
        });
        style.update({});
        t.assert.ok(!style._changed);

        const value = style.getLayoutProperty('line', 'line-cap');
        value.stops[0][0] = 1;
        style.setLayoutProperty('line', 'line-cap', value);
        t.assert.ok(style._changed);

        done();
      });
    });
  });

  await t.test('Style.setFilter', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throws if style is not loaded', (t, done) => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.setFilter('symbol', ['==', 'id', 1]), /load/i);
      done();
    });

    function createStyle() {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {
          geojson: createGeoJSONSource()
        },
        layers: [{ id: 'symbol', type: 'symbol', source: 'geojson', filter: ['==', 'id', 0] }]
      });
      return style;
    }

    await t.test('sets filter', (t, done) => {
      style = createStyle();

      t.mock.method(style, '_updateWorkerLayers', () => {
        const layer = style.getLayer('symbol');
        t.assert.deepEqual(layer.id, 'symbol');
        t.assert.deepEqual(layer.filter, ['==', 'id', 1]);
        done();
        return Promise.resolve();
      });

      style.on('style.load', () => {
        const layer = style.getLayer('symbol');
        t.assert.deepEqual(layer.filter, ['==', 'id', 0]);

        style.setFilter('symbol', ['==', 'id', 1]);
        t.assert.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
        style.update({});
      });
    });

    await t.test('gets a clone of the filter', (t, done) => {
      style = createStyle();

      style.on('style.load', () => {
        const filter1 = ['==', 'id', 1];
        style.setFilter('symbol', filter1);
        const filter2 = style.getFilter('symbol');
        const filter3 = style.getLayer('symbol').filter;

        t.assert.notEqual(filter1, filter2);
        t.assert.notEqual(filter1, filter3);
        t.assert.notEqual(filter2, filter3);

        done();
      });
    });

    await t.test('sets again mutated filter', (t, done) => {
      style = createStyle();
      const { mock } = t.mock.method(style, '_updateWorkerLayers', () => {
        const layer = style.getLayer('symbol');
        if (mock.callCount() === 0) {
          t.assert.deepEqual(layer.filter, ['==', 'id', 1]);
        } else if (mock.callCount() === 1) {
          t.assert.deepEqual(layer.filter, ['==', 'id', 2]);
          done();
        }
      });

      style.on('style.load', () => {
        const layer = style.getLayer('symbol');
        t.assert.deepEqual(layer.filter, ['==', 'id', 0]);

        const filter = ['==', 'id', 1];
        style.setFilter('symbol', filter);
        style.update({}); // flush pending operations

        filter[2] = 2;
        style.setFilter('symbol', filter);
        style.update({});
      });
    });

    await t.test('unsets filter', (t, done) => {
      style = createStyle();
      style.on('style.load', () => {
        style.setFilter('symbol', null);
        t.assert.equal(style.getLayer('symbol').filter, undefined);
        done();
      });
    });

    await t.test('fires an error if layer not found', (t, done) => {
      style = createStyle();

      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map's style and cannot be filtered/);
          done();
        });
        style.setFilter('non-existant', ['==', 'id', 1]);
      });
    });
  });

  await t.test('Style.setLayerZoomRange', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throw before loaded', (t, done) => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.setLayerZoomRange('symbol', 5, 12), /load/i);
      done();
    });

    function createStyle() {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {
          geojson: createGeoJSONSource()
        },
        layers: [
          {
            id: 'symbol',
            type: 'symbol',
            source: 'geojson'
          }
        ]
      });
      return style;
    }

    await t.test('sets zoom range', (t, done) => {
      style = createStyle();
      style.on('style.load', () => {
        style.setLayerZoomRange('symbol', 5, 12);
        t.assert.equal(style.getLayer('symbol').minzoom, 5, 'set minzoom');
        t.assert.equal(style.getLayer('symbol').maxzoom, 12, 'set maxzoom');
        done();
      });
    });

    await t.test('fires an error if layer not found', (t, done) => {
      style = createStyle();
      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map's style and cannot have zoom extent/);
          done();
        });
        style.setLayerZoomRange('non-existant', 5, 12);
      });
    });
  });

  await t.test('Style.queryRenderedFeatures', (t, done) => {
    const style = new Style(new StubMap());
    const transform = new Transform();
    transform.resize(512, 512);

    function queryMapboxFeatures(layers, getFeatureState, queryGeom, cameraQueryGeom, scale, params) {
      const features = {
        land: [
          {
            type: 'Feature',
            layer: style._layers.get('land'),
            geometry: {
              type: 'Polygon'
            }
          },
          {
            type: 'Feature',
            layer: style._layers.get('land'),
            geometry: {
              type: 'Point'
            }
          }
        ],
        landref: [
          {
            type: 'Feature',
            layer: style._layers.get('landref'),
            geometry: {
              type: 'Line'
            }
          }
        ]
      };

      // format result to shape of tile.queryRenderedFeatures result
      for (const layer in features) {
        features[layer] = features[layer].map((feature, featureIndex) => ({ feature, featureIndex }));
      }

      if (params.layers) {
        for (const l in features) {
          if (params.layers.indexOf(l) < 0) {
            delete features[l];
          }
        }
      }

      return features;
    }

    style.loadJSON({
      version: 8,
      sources: {
        mapbox: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        },
        other: {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        }
      },
      layers: [
        {
          id: 'land',
          type: 'line',
          source: 'mapbox',
          'source-layer': 'water',
          layout: {
            'line-cap': 'round'
          },
          paint: {
            'line-color': 'red'
          },
          metadata: {
            something: 'else'
          }
        },
        {
          id: 'landref',
          type: 'line',
          source: 'mapbox',
          'source-layer': 'water',
          layout: {
            'line-cap': 'round'
          },
          paint: {
            'line-color': 'blue'
          }
        },
        {
          id: 'land--other',
          type: 'line',
          source: 'other',
          'source-layer': 'water',
          layout: {
            'line-cap': 'round'
          },
          paint: {
            'line-color': 'red'
          },
          metadata: {
            something: 'else'
          }
        }
      ]
    });

    style.on('style.load', async () => {
      style._sources.mapbox.tilesIn = () => {
        return [
          {
            tile: { queryRenderedFeatures: queryMapboxFeatures },
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            queryGeometry: [],
            scale: 1
          }
        ];
      };
      style._sources.other.tilesIn = () => {
        return [];
      };

      style._sources.mapbox.transform = transform;
      style._sources.other.transform = transform;

      style.update({ zoom: 0 });
      style._updateSources(transform);

      await t.test('returns feature type', (t, done) => {
        const results = style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], {}, transform);
        t.assert.equal(results[0].geometry.type, 'Line');
        done();
      });

      await t.test('filters by `layers` option', (t, done) => {
        const results = style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], { layers: ['land'] }, transform);
        t.assert.equal(results.length, 2);
        done();
      });

      await t.test('checks type of `layers` option', (t, done) => {
        let errors = 0;
        t.mock.method(style, 'fire', event => {
          if (event.error?.message.includes('parameters.layers must be an Array.')) {
            errors++;
          }
        });
        style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], { layers: 'string' }, transform);
        t.assert.equal(errors, 1);
        done();
      });

      await t.test('includes layout properties', (t, done) => {
        const results = style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], {}, transform);
        const layout = results[0].layer.layout;
        t.assert.deepEqual(layout['line-cap'], 'round');
        done();
      });

      await t.test('includes paint properties', (t, done) => {
        const results = style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], {}, transform);
        t.assert.deepEqual(results[2].layer.paint['line-color'], 'red');
        done();
      });

      await t.test('includes metadata', (t, done) => {
        const results = style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], {}, transform);

        const layer = results[1].layer;
        t.assert.equal(layer.metadata.something, 'else');

        done();
      });

      await t.test('include multiple layers', (t, done) => {
        const results = style.queryRenderedFeatures(
          [{ column: 1, row: 1, zoom: 1 }],
          { layers: ['land', 'landref'] },
          transform
        );
        t.assert.equal(results.length, 3);
        done();
      });

      await t.test('does not query sources not implicated by `layers` parameter', (t, done) => {
        style._sources.mapbox.queryRenderedFeatures = function () {
          t.assert.fail();
        };
        style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], { layers: ['land--other'] }, transform);
        done();
      });

      await t.test('ignores layer included in params if it does not exist on the style', (t, done) => {
        let errors = 0;
        t.mock.method(style, 'fire', event => {
          if (event.error?.message.includes("does not exist in the map's style and cannot be queried for features.")) {
            errors++;
          }
        });
        const results = style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], { layers: ['merp'] }, transform);
        t.assert.equal(errors, 0);
        t.assert.equal(results.length, 0);
        done();
      });

      style._remove();
      done();
    });
  });

  await t.test('Style defers expensive methods', (t, done) => {
    const style = new Style(new StubMap());
    style.loadJSON(
      createStyleJSON({
        sources: {
          streets: createGeoJSONSource(),
          terrain: createGeoJSONSource()
        }
      })
    );

    style.on('style.load', () => {
      style.update({});

      // spies to track defered methods
      t.mock.method(style, 'fire');
      t.mock.method(style, '_reloadSource');
      t.mock.method(style, '_updateWorkerLayers');

      style.addLayer({ id: 'first', type: 'symbol', source: 'streets' });
      style.addLayer({ id: 'second', type: 'symbol', source: 'streets' });
      style.addLayer({ id: 'third', type: 'symbol', source: 'terrain' });

      style.setPaintProperty('first', 'text-color', 'black');
      style.setPaintProperty('first', 'text-halo-color', 'white');

      t.assert.ok(!style.fire.mock.callCount() > 0, 'fire is deferred');
      t.assert.ok(!style._reloadSource.mock.callCount() > 0, '_reloadSource is deferred');
      t.assert.ok(!style._updateWorkerLayers.mock.callCount() > 0, '_updateWorkerLayers is deferred');

      style.update({});

      t.assert.equal(style.fire.mock.calls[0].arguments[0].type, 'data', 'a data event was fired');

      // called per source
      t.assert.equal(style._reloadSource.mock.callCount(), 2, '_reloadSource is called per source');
      t.assert.equal(style._reloadSource.mock.calls[0].arguments[0], 'streets', '_reloadSource is called for streets');
      t.assert.equal(style._reloadSource.mock.calls[1].arguments[0], 'terrain', '_reloadSource is called for terrain');

      // called once
      t.assert.equal(style._updateWorkerLayers.mock.callCount(), 1, '_updateWorkerLayers is called once');

      style._remove();
      done();
    });
  });

  await t.test('Style.hasTransitions', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('returns false when the style is loading', t => {
      style = new Style(new StubMap());
      t.assert.equal(style.hasTransitions(), false);
    });

    await t.test('returns true when a property is transitioning', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background'
          }
        ]
      });

      style.on('style.load', () => {
        style.setPaintProperty('background', 'background-color', 'blue');
        style.update({ transition: { duration: 300, delay: 0 } });
        t.assert.equal(style.hasTransitions(), true);
        done();
      });
    });

    await t.test('returns false when a property is not transitioning', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON({
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background'
          }
        ]
      });

      style.on('style.load', () => {
        style.setPaintProperty('background', 'background-color', 'blue');
        style.update({ transition: { duration: 0, delay: 0 } });
        t.assert.equal(style.hasTransitions(), false);
        done();
      });
    });
  });
});
