const test = require('node:test');
const Map = require('../../../../src/ui/map');
const { Event } = require('@mapwhit/events');
const { serialize } = require('../../../util/serialize_style');

const fixed = require('../../../util/mapbox-gl-js-test/fixed');
const fixedNum = fixed.Num;
const fixedLngLat = fixed.LngLat;
const { createMap, createStyleSource, createStyle, initWindow } = require('../../../util/util');

test('setStyle', async t => {
  initWindow(t);

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

test('getStyle', async t => {
  initWindow(t);

  await t.test('returns the style', (t, done) => {
    const style = createStyle();
    const map = createMap({ style: style });
    map.style.serialize = serialize.bind(undefined, map.style);

    map.on('load', () => {
      t.assert.deepEqual(map.getStyle(), style);
      done();
    });
  });

  await t.test('returns the style with added sources', (t, done) => {
    const style = createStyle();
    const map = createMap({ style: style });
    map.style.serialize = serialize.bind(undefined, map.style);

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
    map.style.serialize = serialize.bind(undefined, map.style);
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
    map.style.serialize = serialize.bind(undefined, map.style);
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
