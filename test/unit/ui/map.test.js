const test = require('node:test');
const _window = require('../../util/window');
const Map = require('../../../src/ui/map');
const LngLat = require('../../../src/geo/lng_lat');
const Tile = require('../../../src/source/tile');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const { Event, ErrorEvent } = require('@mapwhit/events');

const fixed = require('../../util/mapbox-gl-js-test/fixed');
const fixedNum = fixed.Num;
const fixedLngLat = fixed.LngLat;
const fixedCoord = fixed.Coord;

function createMap(options, callback) {
  const container = window.document.createElement('div');
  Object.defineProperty(container, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(container, 'offsetHeight', { value: 200, configurable: true });

  const map = new Map(
    Object.assign(
      {
        container: container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      },
      options
    )
  );

  if (callback)
    map.on('load', () => {
      callback(null, map);
    });

  return map;
}

function createStyleSource() {
  return {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  };
}

test('Map', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('constructor', t => {
    const map = createMap({ interactive: true, style: null });
    t.assert.ok(map.getContainer());
    t.assert.equal(map.getStyle(), undefined);
    t.assert.throws(
      () => {
        new Map({
          container: 'anElementIdWhichDoesNotExistInTheDocument'
        });
      },
      new Error("Container 'anElementIdWhichDoesNotExistInTheDocument' not found."),
      'throws on invalid map container id'
    );
  });

  await t.test('emits load event after a style is set', (t, done) => {
    const map = new Map({ container: window.document.createElement('div') });

    map.on('load', fail);

    setTimeout(() => {
      map.off('load', fail);
      map.on('load', pass);
      map.setStyle(createStyle());
    }, 1);

    function fail() {
      t.assert.ok(false);
    }
    function pass() {
      done();
    }
  });

  await t.test('setStyle', async t => {
    await t.test('returns self', t => {
      const map = new Map({ container: window.document.createElement('div') });
      t.assert.equal(
        map.setStyle({
          version: 8,
          sources: {},
          layers: []
        }),
        map
      );
    });

    await t.test('sets up event forwarding', (t, done) => {
      createMap({}, (error, map) => {
        t.assert.ifError(error);

        const events = [];
        function recordEvent(event) {
          events.push(event.type);
        }

        map.on('error', recordEvent);
        map.on('data', recordEvent);
        map.on('dataloading', recordEvent);

        map.style.fire(new Event('error'));
        map.style.fire(new Event('data'));
        map.style.fire(new Event('dataloading'));

        t.assert.deepEqual(events, ['error', 'data', 'dataloading']);
        done();
      });
    });

    await t.test('fires *data and *dataloading events', (t, done) => {
      createMap({}, (error, map) => {
        t.assert.ifError(error);

        const events = [];
        function recordEvent(event) {
          events.push(event.type);
        }

        map.on('styledata', recordEvent);
        map.on('styledataloading', recordEvent);
        map.on('sourcedata', recordEvent);
        map.on('sourcedataloading', recordEvent);
        map.on('tiledata', recordEvent);
        map.on('tiledataloading', recordEvent);

        map.style.fire(new Event('data', { dataType: 'style' }));
        map.style.fire(new Event('dataloading', { dataType: 'style' }));
        map.style.fire(new Event('data', { dataType: 'source' }));
        map.style.fire(new Event('dataloading', { dataType: 'source' }));
        map.style.fire(new Event('data', { dataType: 'tile' }));
        map.style.fire(new Event('dataloading', { dataType: 'tile' }));

        t.assert.deepEqual(events, [
          'styledata',
          'styledataloading',
          'sourcedata',
          'sourcedataloading',
          'tiledata',
          'tiledataloading'
        ]);
        done();
      });
    });

    await t.test('can be called more than once', () => {
      const map = createMap();

      map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
      map.setStyle({ version: 8, sources: {}, layers: [] }, { diff: false });
    });

    await t.test('style transform overrides unmodified map transform', (t, done) => {
      const map = new Map({ container: window.document.createElement('div') });
      map.transform.lngRange = [-120, 140];
      map.transform.latRange = [-60, 80];
      map.transform.resize(600, 400);
      t.assert.equal(map.transform.zoom, 0.6983039737971012, 'map transform is constrained');
      t.assert.ok(map.transform.unmodified, 'map transform is not modified');
      map.setStyle(createStyle());
      map.on('style.load', () => {
        t.assert.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -73.9749, lat: 40.7736 }));
        t.assert.equal(fixedNum(map.transform.zoom), 12.5);
        t.assert.equal(fixedNum(map.transform.bearing), 29);
        t.assert.equal(fixedNum(map.transform.pitch), 50);
        done();
      });
    });

    await t.test('style transform does not override map transform modified via options', (t, done) => {
      const map = new Map({
        container: window.document.createElement('div'),
        zoom: 10,
        center: [-77.0186, 38.8888]
      });
      t.assert.ok(!map.transform.unmodified, 'map transform is modified by options');
      map.setStyle(createStyle());
      map.on('style.load', () => {
        t.assert.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -77.0186, lat: 38.8888 }));
        t.assert.equal(fixedNum(map.transform.zoom), 10);
        t.assert.equal(fixedNum(map.transform.bearing), 0);
        t.assert.equal(fixedNum(map.transform.pitch), 0);
        done();
      });
    });

    await t.test('style transform does not override map transform modified via setters', (t, done) => {
      const map = new Map({ container: window.document.createElement('div') });
      t.assert.ok(map.transform.unmodified);
      map.setZoom(10);
      map.setCenter([-77.0186, 38.8888]);
      t.assert.ok(!map.transform.unmodified, 'map transform is modified via setters');
      map.setStyle(createStyle());
      map.on('style.load', () => {
        t.assert.deepEqual(fixedLngLat(map.transform.center), fixedLngLat({ lng: -77.0186, lat: 38.8888 }));
        t.assert.equal(fixedNum(map.transform.zoom), 10);
        t.assert.equal(fixedNum(map.transform.bearing), 0);
        t.assert.equal(fixedNum(map.transform.pitch), 0);
        done();
      });
    });

    await t.test('passing null removes style', (t, done) => {
      const map = createMap();
      const style = map.style;
      t.assert.ok(style);
      t.mock.method(style, '_remove');
      map.setStyle(null);
      t.assert.equal(style._remove.mock.callCount(), 1);
      done();
    });
  });

  await t.test('is_Loaded', async t => {
    await t.test('Map.isSourceLoaded', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });

      map.on('load', () => {
        map.on('data', e => {
          if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
            t.assert.equal(map.isSourceLoaded('geojson'), true, 'true when loaded');
            done();
          }
        });
        map.addSource('geojson', createStyleSource());
        t.assert.equal(map.isSourceLoaded('geojson'), false, 'false before loaded');
      });
    });

    await t.test('Map.isStyleLoaded', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });

      t.assert.equal(map.isStyleLoaded(), false, 'false before style has loaded');
      map.on('load', () => {
        t.assert.equal(map.isStyleLoaded(), true, 'true when style is loaded');
        done();
      });
    });

    await t.test('Map.areTilesLoaded', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });
      t.assert.equal(map.areTilesLoaded(), true, 'returns true if there are no sources on the map');
      map.on('load', () => {
        map.addSource('geojson', createStyleSource());
        map.style.sourceCaches.geojson._tiles.fakeTile = new Tile(new OverscaledTileID(0, 0, 0, 0, 0));
        t.assert.equal(map.areTilesLoaded(), false, 'returns false if tiles are loading');
        map.style.sourceCaches.geojson._tiles.fakeTile.state = 'loaded';
        t.assert.equal(map.areTilesLoaded(), true, 'returns true if tiles are loaded');
        done();
      });
    });
  });

  await t.test('getStyle', async t => {
    await t.test('returns the style', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });

      map.on('load', () => {
        t.assert.deepEqual(map.getStyle(), style);
        done();
      });
    });

    await t.test('returns the style with added sources', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });

      map.on('load', () => {
        map.addSource('geojson', createStyleSource());
        t.assert.deepEqual(
          map.getStyle(),
          Object.assign(createStyle(), {
            sources: { geojson: createStyleSource() }
          })
        );
        done();
      });
    });

    await t.test('fires an error on checking if non-existant source is loaded', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });

      map.on('load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /There is no source with ID/);
          done();
        });
        map.isSourceLoaded('geojson');
      });
    });

    await t.test('returns the style with added layers', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });
      const layer = {
        id: 'background',
        type: 'background'
      };

      map.on('load', () => {
        map.addLayer(layer);
        t.assert.deepEqual(
          map.getStyle(),
          Object.assign(createStyle(), {
            layers: [layer]
          })
        );
        done();
      });
    });

    await t.test('returns the style with added source and layer', (t, done) => {
      const style = createStyle();
      const map = createMap({ style: style });
      const source = createStyleSource();
      const layer = {
        id: 'fill',
        type: 'fill',
        source: 'fill'
      };

      map.on('load', () => {
        map.addSource('fill', source);
        map.addLayer(layer);
        t.assert.deepEqual(
          map.getStyle(),
          Object.assign(createStyle(), {
            sources: { fill: source },
            layers: [layer]
          })
        );
        done();
      });
    });
  });

  await t.test('moveLayer', (t, done) => {
    const map = createMap({
      style: Object.assign(createStyle(), {
        sources: {
          mapbox: {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: async () => {}
          }
        },
        layers: [
          {
            id: 'layerId1',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
          },
          {
            id: 'layerId2',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
          }
        ]
      })
    });

    map.once('render', () => {
      map.moveLayer('layerId1', 'layerId2');
      t.assert.equal(map.getLayer('layerId1').id, 'layerId1');
      t.assert.equal(map.getLayer('layerId2').id, 'layerId2');
      done();
    });
  });

  await t.test('getLayer', (t, done) => {
    const layer = {
      id: 'layerId',
      type: 'circle',
      source: 'mapbox',
      'source-layer': 'sourceLayer'
    };
    const map = createMap({
      style: Object.assign(createStyle(), {
        sources: {
          mapbox: {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: async () => {}
          }
        },
        layers: [layer]
      })
    });

    map.once('render', () => {
      const mapLayer = map.getLayer('layerId');
      t.assert.equal(mapLayer.id, layer.id);
      t.assert.equal(mapLayer.type, layer.type);
      t.assert.equal(mapLayer.source, layer.source);
      done();
    });
  });

  await t.test('resize', async t => {
    await t.test('sets width and height from container offsets', (t, done) => {
      const map = createMap();
      const container = map.getContainer();

      Object.defineProperty(container, 'offsetWidth', { value: 250 });
      Object.defineProperty(container, 'offsetHeight', { value: 250 });
      map.resize();

      t.assert.equal(map.transform.width, 250);
      t.assert.equal(map.transform.height, 250);

      done();
    });

    await t.test('fires movestart, move, resize, and moveend events', async t => {
      const map = createMap();
      const events = [];

      ['movestart', 'move', 'resize', 'moveend'].forEach(event => {
        map.on(event, e => {
          events.push(e.type);
        });
      });

      map.resize();
      t.assert.deepEqual(events, ['movestart', 'move', 'resize', 'moveend']);
    });

    await t.test('listen to window resize event', (t, done) => {
      window.addEventListener = function (type) {
        if (type === 'resize') {
          //restore empty function not to mess with other tests
          window.addEventListener = function () {};

          done();
        }
      };

      createMap();
    });

    await t.test('do not resize if trackResize is false', t => {
      const map = createMap({ trackResize: false });

      t.mock.method(map, 'stop');
      t.mock.method(map, '_update');
      t.mock.method(map, 'resize');

      map._onWindowResize();

      t.assert.equal(map.stop.mock.callCount(), 0);
      t.assert.equal(map._update.mock.callCount(), 0);
      t.assert.equal(map.resize.mock.callCount(), 0);
    });

    await t.test('do resize if trackResize is true (default)', t => {
      const map = createMap();

      t.mock.method(map, 'stop');
      t.mock.method(map, '_update');
      t.mock.method(map, 'resize');

      map._onWindowResize();

      t.assert.ok(map.stop.mock.callCount() > 0);
      t.assert.ok(map._update.mock.callCount() > 0);
      t.assert.ok(map.resize.mock.callCount() > 0);
    });
  });

  await t.test('getBounds', async t => {
    const map = createMap({ zoom: 0 });
    t.assert.deepEqual(Number.parseFloat(map.getBounds().getCenter().lng.toFixed(10)), 0, 'getBounds');
    t.assert.deepEqual(Number.parseFloat(map.getBounds().getCenter().lat.toFixed(10)), 0, 'getBounds');

    t.assert.deepEqual(
      toFixed(map.getBounds().toArray()),
      toFixed([
        [-70.31249999999976, -57.326521225216965],
        [70.31249999999977, 57.32652122521695]
      ])
    );

    await t.test('rotated bounds', t => {
      const map = createMap({ zoom: 1, bearing: 45 });
      t.assert.deepEqual(
        toFixed([
          [-49.718445552178764, -44.44541580601936],
          [49.7184455522, 44.445415806019355]
        ]),
        toFixed(map.getBounds().toArray())
      );

      map.setBearing(135);
      t.assert.deepEqual(
        toFixed([
          [-49.718445552178764, -44.44541580601936],
          [49.7184455522, 44.445415806019355]
        ]),
        toFixed(map.getBounds().toArray())
      );
    });

    function toFixed(bounds) {
      const n = 10;
      return [
        [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
        [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
      ];
    }

    function normalizeFixed(num, n) {
      // workaround for "-0.0000000000" ≠ "0.0000000000"
      return Number.parseFloat(num.toFixed(n)).toFixed(n);
    }
  });

  await t.test('setMaxBounds', async t => {
    await t.test('constrains map bounds', t => {
      const map = createMap({ zoom: 0 });
      map.setMaxBounds([
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ]);
      t.assert.deepEqual(
        toFixed([
          [-130.4297, 7.0136641176],
          [-61.52344, 60.2398142283]
        ]),
        toFixed(map.getBounds().toArray())
      );
    });

    await t.test('when no argument is passed, map bounds constraints are removed', t => {
      const map = createMap({ zoom: 0 });
      map.setMaxBounds([
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ]);
      t.assert.deepEqual(
        toFixed([
          [-166.28906999999964, -27.6835270554],
          [-25.664070000000066, 73.8248206697]
        ]),
        toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray())
      );
    });

    await t.test('should not zoom out farther than bounds', t => {
      const map = createMap();
      map.setMaxBounds([
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ]);
      t.assert.notEqual(map.setZoom(0).getZoom(), 0);
    });

    await t.test('throws on invalid bounds', t => {
      const map = createMap({ zoom: 0 });
      t.assert.throws(
        () => {
          map.setMaxBounds([-130.4297, 50.0642], [-61.52344, 24.20688]);
        },
        Error,
        'throws on two decoupled array coordinate arguments'
      );
      t.assert.throws(
        () => {
          map.setMaxBounds(-130.4297, 50.0642, -61.52344, 24.20688);
        },
        Error,
        'throws on individual coordinate arguments'
      );
    });

    function toFixed(bounds) {
      const n = 9;
      return [
        [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
        [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
      ];
    }
  });

  await t.test('getMaxBounds', async t => {
    await t.test('returns null when no bounds set', t => {
      const map = createMap({ zoom: 0 });
      t.assert.equal(map.getMaxBounds(), null);
    });

    await t.test('returns bounds', t => {
      const map = createMap({ zoom: 0 });
      const bounds = [
        [-130.4297, 50.0642],
        [-61.52344, 24.20688]
      ];
      map.setMaxBounds(bounds);
      t.assert.deepEqual(map.getMaxBounds().toArray(), bounds);
    });
  });

  await t.test('getRenderWorldCopies', async t => {
    await t.test('initially false', t => {
      const map = createMap({ renderWorldCopies: false });
      t.assert.equal(map.getRenderWorldCopies(), false);
    });

    await t.test('initially true', t => {
      const map = createMap({ renderWorldCopies: true });
      t.assert.equal(map.getRenderWorldCopies(), true);
    });
  });

  await t.test('setRenderWorldCopies', async t => {
    await t.test('initially false', t => {
      const map = createMap({ renderWorldCopies: false });
      map.setRenderWorldCopies(true);
      t.assert.equal(map.getRenderWorldCopies(), true);
    });

    await t.test('initially true', t => {
      const map = createMap({ renderWorldCopies: true });
      map.setRenderWorldCopies(false);
      t.assert.equal(map.getRenderWorldCopies(), false);
    });

    await t.test('undefined', t => {
      const map = createMap({ renderWorldCopies: false });
      map.setRenderWorldCopies(undefined);
      t.assert.equal(map.getRenderWorldCopies(), true);
    });

    await t.test('null', t => {
      const map = createMap({ renderWorldCopies: true });
      map.setRenderWorldCopies(null);
      t.assert.equal(map.getRenderWorldCopies(), false);
    });
  });

  await t.test('setMinZoom', t => {
    const map = createMap({ zoom: 5 });
    map.setMinZoom(3.5);
    map.setZoom(1);
    t.assert.equal(map.getZoom(), 3.5);
  });

  await t.test('unset minZoom', t => {
    const map = createMap({ minZoom: 5 });
    map.setMinZoom(null);
    map.setZoom(1);
    t.assert.equal(map.getZoom(), 1);
  });

  await t.test('getMinZoom', t => {
    const map = createMap({ zoom: 0 });
    t.assert.equal(map.getMinZoom(), 0, 'returns default value');
    map.setMinZoom(10);
    t.assert.equal(map.getMinZoom(), 10, 'returns custom value');
  });

  await t.test('ignore minZooms over maxZoom', async t => {
    const map = createMap({ zoom: 2, maxZoom: 5 });
    t.assert.throws(() => {
      map.setMinZoom(6);
    });
    map.setZoom(0);
    t.assert.equal(map.getZoom(), 0);
  });

  await t.test('setMaxZoom', t => {
    const map = createMap({ zoom: 0 });
    map.setMaxZoom(3.5);
    map.setZoom(4);
    t.assert.equal(map.getZoom(), 3.5);
  });

  await t.test('unset maxZoom', t => {
    const map = createMap({ maxZoom: 5 });
    map.setMaxZoom(null);
    map.setZoom(6);
    t.assert.equal(map.getZoom(), 6);
  });

  await t.test('getMaxZoom', t => {
    const map = createMap({ zoom: 0 });
    t.assert.equal(map.getMaxZoom(), 22, 'returns default value');
    map.setMaxZoom(10);
    t.assert.equal(map.getMaxZoom(), 10, 'returns custom value');
  });

  await t.test('ignore maxZooms over minZoom', async t => {
    const map = createMap({ minZoom: 5 });
    t.assert.throws(() => {
      map.setMaxZoom(4);
    });
    map.setZoom(5);
    t.assert.equal(map.getZoom(), 5);
  });

  await t.test('throw on maxZoom smaller than minZoom at init', async t => {
    t.assert.throws(() => {
      createMap({ minZoom: 10, maxZoom: 5 });
    }, new Error('maxZoom must be greater than minZoom'));
  });

  await t.test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', async t => {
    t.assert.throws(() => {
      createMap({ minZoom: 1, maxZoom: 0 });
    }, new Error('maxZoom must be greater than minZoom'));
  });

  await t.test('remove', t => {
    const map = createMap();
    t.assert.equal(map.getContainer().childNodes.length, 2);
    map.remove();
    t.assert.equal(map.getContainer().childNodes.length, 0);
  });

  await t.test('addControl', (t, done) => {
    const map = createMap();
    const control = {
      onAdd: function (_) {
        t.assert.equal(map, _, 'addTo() called with map');
        done();
        return window.document.createElement('div');
      }
    };
    map.addControl(control);
  });

  await t.test('removeControl', (t, done) => {
    const map = createMap();
    const control = {
      onAdd: function () {
        return window.document.createElement('div');
      },
      onRemove: function (_) {
        t.assert.equal(map, _, 'onRemove() called with map');
        done();
      }
    };
    map.addControl(control);
    map.removeControl(control);
  });

  await t.test('project', t => {
    const map = createMap();
    t.assert.deepEqual(map.project([0, 0]), { x: 100, y: 100 });
  });

  await t.test('unproject', t => {
    const map = createMap();
    t.assert.deepEqual(fixedLngLat(map.unproject([100, 100])), { lng: 0, lat: 0 });
  });

  await t.test('listImages', (t, done) => {
    const map = createMap();

    map.on('load', () => {
      t.assert.equal(map.listImages().length, 0);

      map.addImage('img', { width: 1, height: 1, data: new Uint8Array(4) });

      const images = map.listImages();
      t.assert.equal(images.length, 1);
      t.assert.equal(images[0], 'img');
      done();
    });
  });

  await t.test('listImages throws an error if called before "load"', t => {
    const map = createMap();
    t.assert.throws(() => {
      map.listImages();
    }, Error);
  });

  await t.test('queryRenderedFeatures', async t => {
    await t.test('if no arguments provided', (t, done) => {
      createMap({}, (err, map) => {
        t.assert.ifError(err);
        t.mock.method(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures();

        const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
        t.assert.ok(args[0]);
        t.assert.deepEqual(args[1], {});
        t.assert.deepEqual(output, []);

        done();
      });
    });

    await t.test('if only "geometry" provided', (t, done) => {
      createMap({}, (err, map) => {
        t.assert.ifError(err);
        t.mock.method(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures(map.project(new LngLat(0, 0)));

        const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
        t.assert.deepEqual(
          args[0].worldCoordinate.map(c => fixedCoord(c)),
          [{ column: 0.5, row: 0.5, zoom: 0 }]
        ); // query geometry
        t.assert.deepEqual(args[1], {}); // params
        t.assert.deepEqual(args[2], map.transform); // transform
        t.assert.deepEqual(output, []);

        done();
      });
    });

    await t.test('if only "params" provided', (t, done) => {
      createMap({}, (err, map) => {
        t.assert.ifError(err);
        t.mock.method(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures({ filter: ['all'] });

        const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
        t.assert.ok(args[0]);
        t.assert.deepEqual(args[1], { filter: ['all'] });
        t.assert.deepEqual(output, []);

        done();
      });
    });

    await t.test('if both "geometry" and "params" provided', (t, done) => {
      createMap({}, (err, map) => {
        t.assert.ifError(err);
        t.mock.method(map.style, 'queryRenderedFeatures');

        const output = map.queryRenderedFeatures({ filter: ['all'] });

        const args = map.style.queryRenderedFeatures.mock.calls[0].arguments;
        t.assert.ok(args[0]);
        t.assert.deepEqual(args[1], { filter: ['all'] });
        t.assert.deepEqual(output, []);

        done();
      });
    });

    await t.test('queryRenderedFeatures returns empty array when geometry is outside map bounds', (t, done) => {
      createMap({}, (err, map) => {
        t.assert.ifError(err);
        t.mock.method(map.style, 'queryRenderedFeatures');

        map.queryRenderedFeatures(map.project(new LngLat(360, 0)));

        const coords = map.style.queryRenderedFeatures.mock.calls[0].arguments[0].worldCoordinate.map(c =>
          fixedCoord(c)
        );
        t.assert.equal(coords[0].column, 1.5);
        t.assert.equal(coords[0].row, 0.5);
        t.assert.equal(coords[0].zoom, 0);

        done();
      });
    });

    await t.test('returns an empty array when no style is loaded', t => {
      const map = createMap({ style: undefined });
      t.assert.deepEqual(map.queryRenderedFeatures(), []);
    });
  });

  await t.test('setLayoutProperty', async t => {
    await t.test('sets property', (t, done) => {
      const map = createMap({
        style: {
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
              id: 'symbol',
              type: 'symbol',
              source: 'geojson',
              layout: {
                'text-transform': 'uppercase'
              }
            }
          ]
        }
      });

      map.on('style.load', () => {
        const updateLayers = t.mock.method(map.style.workerState, 'updateLayers');

        map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
        map.style.update({});
        t.assert.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
        t.assert.equal(updateLayers.mock.callCount(), 1);
        done();
      });
    });

    await t.test('throw before loaded', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      t.assert.throws(
        () => {
          map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
        },
        Error,
        /load/i
      );
    });

    await t.test('fires an error if layer not found', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      map.on('style.load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be styled/);
          done();
        });
        map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
      });
    });

    await t.test('fires a data event', (t, done) => {
      // background layers do not have a source
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      map.once('style.load', () => {
        map.once('data', e => {
          if (e.dataType === 'style') {
            done();
          }
        });

        map.setLayoutProperty('background', 'visibility', 'visible');
      });
    });

    await t.test('sets visibility on background layer', (t, done) => {
      // background layers do not have a source
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      map.on('style.load', () => {
        map.setLayoutProperty('background', 'visibility', 'visible');
        t.assert.deepEqual(map.getLayoutProperty('background', 'visibility'), 'visible');
        done();
      });
    });

    await t.test('sets visibility on raster layer', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: async () => {}
            }
          },
          layers: [
            {
              id: 'satellite',
              type: 'raster',
              source: 'satellite',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      // Suppress errors because we're not loading tiles from a real URL.
      map.on('error', () => {});

      map.on('style.load', () => {
        map.setLayoutProperty('satellite', 'visibility', 'visible');
        t.assert.deepEqual(map.getLayoutProperty('satellite', 'visibility'), 'visible');
        done();
      });
    });

    await t.test('sets visibility on image layer', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            image: {
              type: 'image',
              url: new ArrayBuffer(0),
              coordinates: [
                [-122.51596391201019, 37.56238816766053],
                [-122.51467645168304, 37.56410183312965],
                [-122.51309394836426, 37.563391708549425],
                [-122.51423120498657, 37.56161849366671]
              ]
            }
          },
          layers: [
            {
              id: 'image',
              type: 'raster',
              source: 'image',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      map.on('style.load', () => {
        map.setLayoutProperty('image', 'visibility', 'visible');
        t.assert.deepEqual(map.getLayoutProperty('image', 'visibility'), 'visible');
        done();
      });
    });
  });

  await t.test('setPaintProperty', async t => {
    await t.test('sets property', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background'
            }
          ]
        }
      });

      map.on('style.load', () => {
        map.setPaintProperty('background', 'background-color', 'red');
        t.assert.deepEqual(map.getPaintProperty('background', 'background-color'), 'red');
        done();
      });
    });

    await t.test('throw before loaded', t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      t.assert.throws(
        () => {
          map.setPaintProperty('background', 'background-color', 'red');
        },
        Error,
        /load/i
      );
    });

    await t.test('fires an error if layer not found', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      map.on('style.load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be styled/);
          done();
        });
        map.setPaintProperty('non-existant', 'background-color', 'red');
      });
    });
  });

  await t.test('setFeatureState', async t => {
    await t.test('sets state', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            geojson: createStyleSource()
          },
          layers: []
        }
      });
      map.on('load', () => {
        map.setFeatureState({ source: 'geojson', id: '12345' }, { hover: true });
        const fState = map.getFeatureState({ source: 'geojson', id: '12345' });
        t.assert.equal(fState.hover, true);
        done();
      });
    });
    await t.test('throw before loaded', t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            geojson: createStyleSource()
          },
          layers: []
        }
      });
      t.assert.throws(
        () => {
          map.setFeatureState({ source: 'geojson', id: '12345' }, { hover: true });
        },
        Error,
        /load/i
      );
    });
    await t.test('fires an error if source not found', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            geojson: createStyleSource()
          },
          layers: []
        }
      });
      map.on('load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /source/);
          done();
        });
        map.setFeatureState({ source: 'vector', id: '12345' }, { hover: true });
      });
    });
    await t.test('fires an error if sourceLayer not provided for a vector source', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            vector: {
              type: 'vector',
              tiles: async () => {}
            }
          },
          layers: []
        }
      });
      map.on('load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /sourceLayer/);
          done();
        });
        map.setFeatureState({ source: 'vector', sourceLayer: 0, id: '12345' }, { hover: true });
      });
    });
    await t.test('fires an error if id not provided', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            vector: {
              type: 'vector',
              tiles: ['http://example.com/{z}/{x}/{y}.png']
            }
          },
          layers: []
        }
      });
      map.on('load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /id/);
          done();
        });
        map.setFeatureState({ source: 'vector', sourceLayer: '1' }, { hover: true });
      });
    });
  });

  await t.test('error event', async t => {
    await t.test('logs errors to console when it has NO listeners', t => {
      const map = createMap();
      const stub = t.mock.method(console, 'error', () => {});
      const error = new Error('test');
      map.fire(new ErrorEvent(error));
      t.assert.equal(stub.mock.callCount(), 1);
      t.assert.equal(stub.mock.calls[0].arguments[0], error);
    });

    await t.test('calls listeners', (t, done) => {
      const map = createMap();
      const error = new Error('test');
      map.on('error', event => {
        t.assert.equal(event.error, error);
        done();
      });
      map.fire(new ErrorEvent(error));
    });
  });

  await t.test('render stabilizes', (t, done) => {
    const style = createStyle();
    style.sources.mapbox = {
      type: 'vector',
      minzoom: 1,
      maxzoom: 10,
      tiles: async () => {}
    };
    style.layers.push({
      id: 'layerId',
      type: 'circle',
      source: 'mapbox',
      'source-layer': 'sourceLayer'
    });

    let timer;
    const map = createMap({ style: style });
    map.on('render', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        map.off('render');
        map.on('render', t.fail);
        t.assert.ok(!map._frameId, 'no rerender scheduled');
        done();
      }, 100);
    });
  });

  await t.test('removeLayer restores Map.loaded() to true', (t, done) => {
    const map = createMap({
      style: Object.assign(createStyle(), {
        sources: {
          mapbox: {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: async () => {}
          }
        },
        layers: [
          {
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
          }
        ]
      })
    });

    map.once('render', () => {
      map.removeLayer('layerId');
      map.on('render', () => {
        if (map.loaded()) {
          map.remove();
          done();
        }
      });
    });
  });
});

function createStyle() {
  return {
    version: 8,
    center: [-73.9749, 40.7736],
    zoom: 12.5,
    bearing: 29,
    pitch: 50,
    sources: {},
    layers: []
  };
}
