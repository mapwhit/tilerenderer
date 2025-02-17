const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');

function createMap() {
  return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('BoxZoomHandler', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('BoxZoomHandler fires boxzoomstart and boxzoomend events at appropriate times', t => {
    const map = createMap();

    const boxzoomstart = t.spy();
    const boxzoomend = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend', boxzoomend);

    simulate.pointerdown(map.getCanvas(), { shiftKey: true, clientX: 0, clientY: 0 });
    map._renderTaskQueue.run();
    t.assert.equal(boxzoomstart.callCount, 0);
    t.assert.equal(boxzoomend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { shiftKey: true, clientX: 5, clientY: 5 });
    map._renderTaskQueue.run();
    t.assert.equal(boxzoomstart.callCount, 1);
    t.assert.equal(boxzoomend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { shiftKey: true, clientX: 5, clientY: 5 });
    map._renderTaskQueue.run();
    t.assert.equal(boxzoomstart.callCount, 1);
    t.assert.equal(boxzoomend.callCount, 1);

    map.remove();
  });

  await t.test('BoxZoomHandler avoids conflicts with DragPanHandler when disabled and reenabled (#2237)', t => {
    const map = createMap();

    map.boxZoom.disable();
    map.boxZoom.enable();

    const boxzoomstart = t.spy();
    const boxzoomend = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend', boxzoomend);

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas(), { shiftKey: true, clientX: 0, clientY: 0 });
    map._renderTaskQueue.run();
    t.assert.equal(boxzoomstart.callCount, 0);
    t.assert.equal(boxzoomend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { shiftKey: true, clientX: 5, clientY: 5 });
    map._renderTaskQueue.run();
    t.assert.equal(boxzoomstart.callCount, 1);
    t.assert.equal(boxzoomend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { shiftKey: true, clientX: 5, clientY: 5 });
    map._renderTaskQueue.run();
    t.assert.equal(boxzoomstart.callCount, 1);
    t.assert.equal(boxzoomend.callCount, 1);

    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    map.remove();
  });

  await t.test('BoxZoomHandler does not begin a box zoom if preventDefault is called on the mousedown event', t => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const boxzoomstart = t.spy();
    const boxzoomend = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend', boxzoomend);

    simulate.pointerdown(map.getCanvas(), { shiftKey: true, clientX: 0, clientY: 0 });
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvas(), { shiftKey: true, clientX: 5, clientY: 5 });
    map._renderTaskQueue.run();

    simulate.pointerup(map.getCanvas(), { shiftKey: true, clientX: 5, clientY: 5 });
    map._renderTaskQueue.run();

    t.assert.equal(boxzoomstart.callCount, 0);
    t.assert.equal(boxzoomend.callCount, 0);

    map.remove();
  });
});
