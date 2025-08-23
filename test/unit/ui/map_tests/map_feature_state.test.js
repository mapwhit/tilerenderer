import test from 'node:test';
import { createMap, createStyleSource, initWindow } from '../../../util/util.js';

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
  await t.test('works with string ids', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 'foo' }, { hover: true });
      const fState = map.getFeatureState({ source: 'geojson', id: 'foo' });
      t.assert.equal(fState.hover, true);
      done();
    });
  });
  await t.test('parses feature id as an int', (t, done) => {
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
      const fState = map.getFeatureState({ source: 'geojson', id: 12345 });
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

test('removeFeatureState', async t => {
  initWindow(t);

  await t.test('accepts "0" id', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 0 }, { hover: true, click: true });
      map.removeFeatureState({ source: 'geojson', id: 0 }, 'hover');
      const fState = map.getFeatureState({ source: 'geojson', id: 0 });
      t.assert.equal(fState.hover, undefined);
      t.assert.equal(fState.click, true);
      done();
    });
  });

  await t.test('accepts string id', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 'foo' }, { hover: true, click: true });
      map.removeFeatureState({ source: 'geojson', id: 'foo' }, 'hover');
      const fState = map.getFeatureState({ source: 'geojson', id: 'foo' });
      t.assert.equal(fState.hover, undefined);
      t.assert.equal(fState.click, true);
      done();
    });
  });

  await t.test('remove specific state property', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 12345 }, { hover: true });
      map.removeFeatureState({ source: 'geojson', id: 12345 }, 'hover');
      const fState = map.getFeatureState({ source: 'geojson', id: 12345 });
      t.assert.equal(fState.hover, undefined);
      done();
    });
  });

  await t.test('remove all state properties of one feature', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 1 }, { hover: true, foo: true });
      map.removeFeatureState({ source: 'geojson', id: 1 });

      const fState = map.getFeatureState({ source: 'geojson', id: 1 });
      t.assert.equal(fState.hover, undefined);
      t.assert.equal(fState.foo, undefined);
      done();
    });
  });

  await t.test('remove properties for zero-based feature IDs.', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 0 }, { hover: true, foo: true });
      map.removeFeatureState({ source: 'geojson', id: 0 });

      const fState = map.getFeatureState({ source: 'geojson', id: 0 });
      t.assert.equal(fState.hover, undefined);
      t.assert.equal(fState.foo, undefined);
      done();
    });
  });

  await t.test('other properties persist when removing specific property', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 1 }, { hover: true, foo: true });
      map.removeFeatureState({ source: 'geojson', id: 1 }, 'hover');

      const fState = map.getFeatureState({ source: 'geojson', id: 1 });
      t.assert.equal(fState.foo, true);
      done();
    });
  });

  await t.test('remove all state properties of all features in source', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 1 }, { hover: true, foo: true });
      map.setFeatureState({ source: 'geojson', id: 2 }, { hover: true, foo: true });

      map.removeFeatureState({ source: 'geojson' });

      const fState1 = map.getFeatureState({ source: 'geojson', id: 1 });
      t.assert.equal(fState1.hover, undefined);
      t.assert.equal(fState1.foo, undefined);

      const fState2 = map.getFeatureState({ source: 'geojson', id: 2 });
      t.assert.equal(fState2.hover, undefined);
      t.assert.equal(fState2.foo, undefined);
      done();
    });
  });

  await t.test('specific state deletion should not interfere with broader state deletion', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 1 }, { hover: true, foo: true });
      map.setFeatureState({ source: 'geojson', id: 2 }, { hover: true, foo: true });

      map.removeFeatureState({ source: 'geojson', id: 1 });
      map.removeFeatureState({ source: 'geojson', id: 1 }, 'foo');

      const fState1 = map.getFeatureState({ source: 'geojson', id: 1 });
      t.assert.equal(fState1.hover, undefined);

      map.setFeatureState({ source: 'geojson', id: 1 }, { hover: true, foo: true });
      map.removeFeatureState({ source: 'geojson' });
      map.removeFeatureState({ source: 'geojson', id: 1 }, 'foo');

      const fState2 = map.getFeatureState({ source: 'geojson', id: 2 });
      t.assert.equal(fState2.hover, undefined);

      map.setFeatureState({ source: 'geojson', id: 2 }, { hover: true, foo: true });
      map.removeFeatureState({ source: 'geojson' });
      map.removeFeatureState({ source: 'geojson', id: 2 }, 'foo');

      const fState3 = map.getFeatureState({ source: 'geojson', id: 2 });
      t.assert.equal(fState3.hover, undefined);
      done();
    });
  });

  await t.test('add/remove and remove/add state', (t, done) => {
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
      map.setFeatureState({ source: 'geojson', id: 12345 }, { hover: true });

      map.removeFeatureState({ source: 'geojson', id: 12345 });
      map.setFeatureState({ source: 'geojson', id: 12345 }, { hover: true });

      const fState1 = map.getFeatureState({ source: 'geojson', id: 12345 });
      t.assert.equal(fState1.hover, true);

      map.removeFeatureState({ source: 'geojson', id: 12345 });

      const fState2 = map.getFeatureState({ source: 'geojson', id: 12345 });
      t.assert.equal(fState2.hover, undefined);
      done();
    });
  });

  await t.test('throw before loaded', () => {
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
        map.removeFeatureState({ source: 'geojson', id: 12345 }, { hover: true });
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
      map.removeFeatureState({ source: 'vector', id: 12345 });
    });
  });

  await t.test('fires an error if sourceLayer not provided for a vector source', (t, done) => {
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
        t.assert.match(error.message, /sourceLayer/);
        done();
      });
      map.removeFeatureState({ source: 'vector', id: 12345 });
    });
  });

  await t.test('fires an error if state property is provided without a feature id', (t, done) => {
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
      map.removeFeatureState({ source: 'vector', sourceLayer: '1' }, 'hover');
    });
  });
});
