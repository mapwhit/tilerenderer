const { test } = require('../../util/mapbox-gl-js-test');
const _window = require('../../util/window');
const Style = require('../../../src/style/style');
const SourceCache = require('../../../src/source/source_cache');
const StyleLayer = require('../../../src/style/style_layer');
const Transform = require('../../../src/geo/transform');
const { Event, Evented } = require('../../../src/util/evented');
const {
  setRTLTextPlugin,
  clearRTLTextPlugin,
  evented: rtlTextPluginEvented
} = require('../../../src/source/rtl_text_plugin');
const { OverscaledTileID } = require('../../../src/source/tile_id');

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

const mockDispatcher = {
  nextWorkerId() {
    return 0;
  },
  async send() {},
  async broadcast() {},
  remove() {}
};

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
      clearRTLTextPlugin();

      t.spy(Style, 'registerForPluginAvailability');

      style = new Style(new StubMap());
      t.spy(style.dispatcher, 'broadcast');
      t.assert.ok(Style.registerForPluginAvailability.calledOnce);

      setRTLTextPlugin('some-bogus-url');
      t.assert.ok(style.dispatcher.broadcast.calledWith('loadRTLTextPlugin', 'https://example.org/some-bogus-url'));
    });

    await t.test('loads plugin immediately if already registered', (t, done) => {
      clearRTLTextPlugin();
      let firstError = true;
      setRTLTextPlugin('/plugin.js', error => {
        // Getting this error message shows the bogus URL was succesfully passed to the worker
        // We'll get the error from all workers, only pay attention to the first one
        if (firstError) {
          t.assert.equal(error.message, 'RTL Text Plugin failed to import scripts from https://example.org/plugin.js');
          done();
          firstError = false;
        }
      });
      style = new Style(createStyleJSON());
    });
  });

  await t.test('Style#loadJSON', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('fires "dataloading" (synchronously)', t => {
      style = new Style(new StubMap());
      const spy = t.spy();

      style.on('dataloading', spy);
      style.loadJSON(createStyleJSON());

      t.assert.ok(spy.calledOnce);
      t.assert.equal(spy.getCall(0).args[0].target, style);
      t.assert.equal(spy.getCall(0).args[0].dataType, 'style');
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
        t.assert.ok(style.sourceCaches['mapbox'] instanceof SourceCache);
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
        style._layers.background.fire(new Event('error', { mapbox: true }));
      });
    });
  });

  await t.test('Style#_remove', async t => {
    await t.test('clears tiles', (t, done) => {
      const style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: { 'source-id': createGeoJSONSource() }
        })
      );

      style.on('style.load', () => {
        const sourceCache = style.sourceCaches['source-id'];
        t.spy(sourceCache, 'clearTiles');
        style._remove();
        t.assert.ok(sourceCache.clearTiles.calledOnce);
        done();
      });
    });

    await t.test('deregisters plugin listener', (t, done) => {
      const style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      t.spy(style.dispatcher, 'broadcast');

      style.on('style.load', () => {
        style._remove();

        rtlTextPluginEvented.fire(new Event('pluginAvailable'));
        t.assert.notOk(style.dispatcher.broadcast.calledWith('loadRTLTextPlugin'));
        done();
      });
    });
  });

  await t.test('Style#update', (t, done) => {
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

    style.on('style.load', () => {
      style.addLayer({ id: 'first', source: 'source', type: 'fill', 'source-layer': 'source-layer' }, 'second');
      style.addLayer({ id: 'third', source: 'source', type: 'fill', 'source-layer': 'source-layer' });
      style.removeLayer('second');

      style.dispatcher.broadcast = function (key, value) {
        t.assert.equal(key, 'updateLayers');
        t.assert.deepEqual(
          value.layers.map(layer => {
            return layer.id;
          }),
          ['first', 'third']
        );
        t.assert.deepEqual(value.removedIds, ['second']);
        style._remove();
        done();
        return Promise.resolve();
      };

      style.update({});
    });
  });

  await t.test('Style#addSource', async t => {
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

    await t.test('fires "data" event', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const source = createSource();
      style.once('data', () => done());
      style.on('style.load', () => {
        style.addSource('source-id', source);
        style.update({});
      });
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
        style.sourceCaches['source-id'].fire(new Event('error'));
        style.sourceCaches['source-id'].fire(new Event('data'));
      });
    });
  });

  await t.test('Style#removeSource', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throw before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.removeSource('source-id'), /load/i);
    });

    await t.test('fires "data" event', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const source = createSource();
      style.once('data', () => done());
      style.on('style.load', () => {
        style.addSource('source-id', source);
        style.removeSource('source-id');
        style.update({});
      });
    });

    await t.test('clears tiles', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(
        createStyleJSON({
          sources: { 'source-id': createGeoJSONSource() }
        })
      );

      style.on('style.load', () => {
        const sourceCache = style.sourceCaches['source-id'];
        t.spy(sourceCache, 'clearTiles');
        style.removeSource('source-id');
        t.assert.ok(sourceCache.clearTiles.calledOnce);
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
        style.update(1, 0);
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
        source = style.sourceCaches['source-id'];

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

  await t.test('Style#setGeoJSONSourceData', async t => {
    const geoJSON = { type: 'FeatureCollection', features: [] };
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throws before loaded', (t, done) => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.setGeoJSONSourceData('source-id', geoJSON), /load/i);
      done();
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

  await t.test('Style#addLayer', async t => {
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
        style._layers.background.fire(new Event('error', { mapbox: true }));
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
          style.sourceCaches['mapbox'].reload = done;
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
            const sourceCache = style.sourceCaches['mapbox'];
            const { reload } = sourceCache;
            sourceCache.reload = () => {
              reload.call(sourceCache);
              sourceCache.reload = reload;
              done();
            };
            t.spy(sourceCache, 'clearTiles');
            assertsOnDone.push(() => {
              t.assert.notOk(sourceCache.clearTiles.called);
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
            const sourceCache = style.sourceCaches['mapbox'];
            t.spy(sourceCache, 'reload');
            assertsOnDone.push(() => {
              t.assert.notOk(sourceCache.reload.called);
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

    await t.test('fires "data" event', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      style.once('data', () => done());

      style.on('style.load', () => {
        style.addLayer(layer);
        style.update({});
      });
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
        t.assert.deepEqual(style._order, ['a', 'b', 'c']);
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
        t.assert.deepEqual(style._order, ['c', 'a', 'b']);
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

  await t.test('Style#removeLayer', async t => {
    let style;
    t.afterEach(() => {
      style._remove();
    });

    await t.test('throw before loaded', t => {
      style = new Style(new StubMap());
      t.assert.throws(() => style.removeLayer('background'), /load/i);
    });

    await t.test('fires "data" event', (t, done) => {
      style = new Style(new StubMap());
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      style.once('data', () => done());

      style.on('style.load', () => {
        style.addLayer(layer);
        style.removeLayer('background');
        style.update({});
      });
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
        const layer = style._layers.background;
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
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be removed/);
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
        t.assert.deepEqual(style._order, ['b']);
        done();
      });
    });

    await t.test('does not remove dereffed layers', (t, done) => {
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
              ref: 'a'
            }
          ]
        })
      );

      style.on('style.load', () => {
        style.removeLayer('a');
        t.assert.equal(style.getLayer('a'), undefined);
        t.assert.notEqual(style.getLayer('b'), undefined);
        done();
      });
    });
  });

  await t.test('Style#moveLayer', async t => {
    let style;

    t.beforeEach(() => {
      style = new Style(new StubMap());
      style.dispatcher = mockDispatcher;
    });

    t.afterEach(() => {
      style._remove();
      style = null;
    });

    await t.test('throw before loaded', t => {
      t.assert.throws(() => style.moveLayer('background'), /load/i);
    });

    await t.test('fires "data" event', (t, done) => {
      style.loadJSON(createStyleJSON());
      const layer = { id: 'background', type: 'background' };

      style.once('data', () => done());

      style.on('style.load', () => {
        style.addLayer(layer);
        style.moveLayer('background');
        style.update({});
      });
    });

    await t.test('fires an error on non-existence', (t, done) => {
      style.loadJSON(createStyleJSON());

      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be moved/);
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
        t.assert.deepEqual(style._order, ['b', 'a', 'c']);
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
        t.assert.deepEqual(style._order, ['a', 'b', 'c']);
        done();
      });
    });
  });

  await t.test('Style#setPaintProperty', async t => {
    let style;

    t.beforeEach(() => {
      style = new Style(new StubMap());
      style.dispatcher = mockDispatcher;
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
        style.update(tr.zoom, 0);
        const sourceCache = style.sourceCaches['geojson'];
        const source = style.getSource('geojson');

        let begun = false;
        let styleUpdateCalled = false;

        t.stub(sourceCache, 'reload').callsFake(() => {
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

  await t.test('Style#getPaintProperty', async t => {
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

  await t.test('Style#setLayoutProperty', async t => {
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

  await t.test('Style#getLayoutProperty', async t => {
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

  await t.test('Style#setFilter', async t => {
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

      style.on('style.load', () => {
        style.dispatcher.broadcast = function (key, value) {
          t.assert.equal(key, 'updateLayers');
          t.assert.deepEqual(value.layers[0].id, 'symbol');
          t.assert.deepEqual(value.layers[0].filter, ['==', 'id', 1]);
          done();
          return Promise.resolve();
        };

        style.setFilter('symbol', ['==', 'id', 1]);
        t.assert.deepEqual(style.getFilter('symbol'), ['==', 'id', 1]);
        style.update({}); // trigger dispatcher broadcast
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

      style.on('style.load', () => {
        const filter = ['==', 'id', 1];
        style.setFilter('symbol', filter);
        style.update({}); // flush pending operations

        style.dispatcher.broadcast = function (key, value) {
          t.assert.equal(key, 'updateLayers');
          t.assert.deepEqual(value.layers[0].id, 'symbol');
          t.assert.deepEqual(value.layers[0].filter, ['==', 'id', 2]);
          done();
        };
        filter[2] = 2;
        style.setFilter('symbol', filter);
        style.update({}); // trigger dispatcher broadcast
      });
    });

    await t.test('unsets filter', (t, done) => {
      style = createStyle();
      style.on('style.load', () => {
        style.setFilter('symbol', null);
        t.assert.equal(style.getLayer('symbol').serialize().filter, undefined);
        done();
      });
    });

    await t.test('fires an error if layer not found', (t, done) => {
      style = createStyle();

      style.on('style.load', () => {
        style.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be filtered/);
          done();
        });
        style.setFilter('non-existant', ['==', 'id', 1]);
      });
    });
  });

  await t.test('Style#setLayerZoomRange', async t => {
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
        style.dispatcher.broadcast = function (key, value) {
          t.assert.equal(key, 'updateLayers');
          t.assert.deepEqual(
            value.map(layer => {
              return layer.id;
            }),
            ['symbol']
          );
        };

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
          t.assert.match(error.message, /does not exist in the map\'s style and cannot have zoom extent/);
          done();
        });
        style.setLayerZoomRange('non-existant', 5, 12);
      });
    });
  });

  await t.test('Style#queryRenderedFeatures', (t, done) => {
    const style = new Style(new StubMap());
    const transform = new Transform();
    transform.resize(512, 512);

    function queryMapboxFeatures(layers, getFeatureState, queryGeom, cameraQueryGeom, scale, params) {
      const features = {
        land: [
          {
            type: 'Feature',
            layer: style._layers.land.serialize(),
            geometry: {
              type: 'Polygon'
            }
          },
          {
            type: 'Feature',
            layer: style._layers.land.serialize(),
            geometry: {
              type: 'Point'
            }
          }
        ],
        landref: [
          {
            type: 'Feature',
            layer: style._layers.landref.serialize(),
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
          ref: 'land',
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
      style.sourceCaches.mapbox.tilesIn = () => {
        return [
          {
            tile: { queryRenderedFeatures: queryMapboxFeatures },
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            queryGeometry: [],
            scale: 1
          }
        ];
      };
      style.sourceCaches.other.tilesIn = () => {
        return [];
      };

      style.sourceCaches.mapbox.transform = transform;
      style.sourceCaches.other.transform = transform;

      style.update(0);
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
        t.stub(style, 'fire').callsFake(event => {
          if (event.error?.message.includes('parameters.layers must be an Array.')) errors++;
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
        style.sourceCaches.mapbox.queryRenderedFeatures = function () {
          t.assert.fail();
        };
        style.queryRenderedFeatures([{ column: 1, row: 1, zoom: 1 }], { layers: ['land--other'] }, transform);
        done();
      });

      await t.test('ignores layer included in params if it does not exist on the style', (t, done) => {
        let errors = 0;
        t.stub(style, 'fire').callsFake(event => {
          if (event.error?.message.includes("does not exist in the map's style and cannot be queried for features."))
            errors++;
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
      t.spy(style, 'fire');
      t.spy(style, '_reloadSource');
      t.spy(style, '_updateWorkerLayers');

      style.addLayer({ id: 'first', type: 'symbol', source: 'streets' });
      style.addLayer({ id: 'second', type: 'symbol', source: 'streets' });
      style.addLayer({ id: 'third', type: 'symbol', source: 'terrain' });

      style.setPaintProperty('first', 'text-color', 'black');
      style.setPaintProperty('first', 'text-halo-color', 'white');

      t.assert.notOk(style.fire.called, 'fire is deferred');
      t.assert.notOk(style._reloadSource.called, '_reloadSource is deferred');
      t.assert.notOk(style._updateWorkerLayers.called, '_updateWorkerLayers is deferred');

      style.update({});

      t.assert.equal(style.fire.args[0][0].type, 'data', 'a data event was fired');

      // called per source
      t.assert.ok(style._reloadSource.calledTwice, '_reloadSource is called per source');
      t.assert.ok(style._reloadSource.calledWith('streets'), '_reloadSource is called for streets');
      t.assert.ok(style._reloadSource.calledWith('terrain'), '_reloadSource is called for terrain');

      // called once
      t.assert.ok(style._updateWorkerLayers.calledOnce, '_updateWorkerLayers is called once');

      style._remove();
      done();
    });
  });

  await t.test('Style#hasTransitions', async t => {
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
