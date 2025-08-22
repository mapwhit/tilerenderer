const test = require('node:test');
const { createMap, createStyleSource, initWindow } = require('../../../util/util');

test('setFeatureState', async t => {
  initWindow(t);

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
