const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');

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

  await t.test('Map#isZooming returns true when scroll zooming', (t, done) => {
    const map = createMap();

    map.on('zoomstart', () => {
      t.assert.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
      t.assert.equal(map.isZooming(), false);
      map.remove();
      done();
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -simulate.magicWheelZoomDelta });
    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();
  });

  await t.test('Map#isZooming returns true when double-click zooming', (t, done) => {
    const map = createMap();

    map.on('zoomstart', () => {
      t.assert.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
      t.assert.equal(map.isZooming(), false);
      map.remove();
      done();
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    now += 500;
    map._renderTaskQueue.run();
  });
});
