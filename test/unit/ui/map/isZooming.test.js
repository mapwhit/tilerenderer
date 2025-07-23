const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const browser = require('../../../../src/util/browser');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');

function createMap() {
  return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('Map#isZooming', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('Map#isZooming returns false by default', t => {
    const map = createMap();
    t.assert.equal(map.isZooming(), false);
    map.remove();
  });

  await t.test('Map#isZooming returns true during a camera zoom animation', (t, done) => {
    const map = createMap();

    map.on('zoomstart', () => {
      t.assert.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
      t.assert.equal(map.isZooming(), false);
      map.remove();
      done();
    });

    map.zoomTo(5, { duration: 0 });
  });
});
