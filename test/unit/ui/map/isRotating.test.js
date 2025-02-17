const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');

function createMap() {
  return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('Map#isRotating', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('Map#isRotating returns false by default', t => {
    const map = createMap();
    t.assert.equal(map.isRotating(), false);
    map.remove();
  });

  await t.test('Map#isRotating returns true during a camera rotate animation', (t, done) => {
    const map = createMap();

    map.on('rotatestart', () => {
      t.assert.equal(map.isRotating(), true);
    });

    map.on('rotateend', () => {
      t.assert.equal(map.isRotating(), false);
      map.remove();
      done();
    });

    map.rotateTo(5, { duration: 0 });
  });

  await t.test('Map#isRotating returns true when drag rotating', (t, done) => {
    const map = createMap();

    map.on('rotatestart', () => {
      t.assert.equal(map.isRotating(), true);
    });

    map.on('rotateend', () => {
      t.assert.equal(map.isRotating(), false);
      map.remove();
      done();
    });

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();
  });
});
