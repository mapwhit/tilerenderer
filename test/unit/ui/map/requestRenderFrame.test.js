const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');

function createMap() {
  return new Map({
    container: DOM.create('div', '', window.document.body),
    style: {
      version: 8,
      sources: {},
      layers: []
    }
  });
}

test('Map#_requestRenderFrame', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('Map#_requestRenderFrame schedules a new render frame if necessary', t => {
    const map = createMap();
    t.mock.method(map, '_rerender', () => {});
    map._requestRenderFrame(() => {});
    t.assert.equal(map._rerender.mock.callCount(), 1);
    map.remove();
  });

  await t.test('Map#_requestRenderFrame queues a task for the next render frame', (t, done) => {
    const map = createMap();
    const cb = t.mock.fn();
    map._requestRenderFrame(cb);
    map.once('render', () => {
      t.assert.equal(cb.mock.callCount(), 1);
      map.remove();
      done();
    });
  });

  await t.test('Map#_cancelRenderFrame cancels a queued task', (t, done) => {
    const map = createMap();
    const cb = t.mock.fn();
    const id = map._requestRenderFrame(cb);
    map._cancelRenderFrame(id);
    map.once('render', () => {
      t.assert.equal(cb.mock.callCount(), 0);
      map.remove();
      done();
    });
  });
});
