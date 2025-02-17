const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');

function createMap() {
  return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('TouchZoomRotateHandler', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test(
    'fires zoomstart, zoom, and zoomend events at appropriate times in response to a pinch-zoom gesture',
    t => {
      const map = createMap();

      const zoomstart = t.spy();
      const zoom = t.spy();
      const zoomend = t.spy();

      map.on('zoomstart', zoomstart);
      map.on('zoom', zoom);
      map.on('zoomend', zoomend);

      const canvas = map.getCanvas();
      simulate.pointerdown(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
      simulate.pointerdown(canvas, { pointerId: 'b', clientX: 0, clientY: 5 });

      map._renderTaskQueue.run();
      t.assert.equal(zoomstart.callCount, 0);
      t.assert.equal(zoom.callCount, 0);
      t.assert.equal(zoomend.callCount, 0);

      simulate.pointermove(canvas, { pointerId: 'a', clientX: 0, clientY: -10 });
      simulate.pointermove(canvas, { pointerId: 'b', clientX: 0, clientY: 10 });

      map._renderTaskQueue.run();
      t.assert.equal(zoomstart.callCount, 1);
      t.assert.equal(zoom.callCount, 1);
      t.assert.equal(zoomend.callCount, 0);

      simulate.pointermove(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
      simulate.pointermove(canvas, { pointerId: 'b', clientX: 0, clientY: 5 });

      map._renderTaskQueue.run();
      t.assert.equal(zoomstart.callCount, 1);
      t.assert.equal(zoom.callCount, 2);
      t.assert.equal(zoomend.callCount, 0);

      simulate.pointerup(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
      map._renderTaskQueue.run();
      t.assert.equal(zoomstart.callCount, 1);
      t.assert.equal(zoom.callCount, 2);
      t.assert.equal(zoomend.callCount, 1);

      map.remove();
    }
  );

  await t.test(
    'fires rotatestart, rotate, and rotateend events at appropriate times in response to a pinch-rotate gesture',
    t => {
      const map = createMap();

      const rotatestart = t.spy();
      const rotate = t.spy();
      const rotateend = t.spy();

      map.on('rotatestart', rotatestart);
      map.on('rotate', rotate);
      map.on('rotateend', rotateend);

      const canvas = map.getCanvas();
      simulate.pointerdown(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
      simulate.pointerdown(canvas, { pointerId: 'b', clientX: 0, clientY: 5 });

      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 0);
      t.assert.equal(rotate.callCount, 0);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointermove(canvas, { pointerId: 'a', clientX: -5, clientY: 0 });
      simulate.pointermove(canvas, { pointerId: 'b', clientX: 5, clientY: 0 });

      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 1);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointermove(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
      simulate.pointermove(canvas, { pointerId: 'b', clientX: 0, clientY: 5 });

      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 2);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointerup(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 2);
      t.assert.equal(rotateend.callCount, 1);

      map.remove();
    }
  );

  await t.test('does not begin a gesture if preventDefault is called on the touchstart event', t => {
    const map = createMap();

    map.on('touchstart', e => e.preventDefault());

    const move = t.spy();
    map.on('move', move);

    const canvas = map.getCanvas();
    simulate.pointerdown(canvas, { pointerId: 'a', clientX: 0, clientY: 0 });
    simulate.pointerdown(canvas, { pointerId: 'b', clientX: 5, clientY: 0 });
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvas(), { pointerId: 'a', clientX: 0, clientY: 0 });
    simulate.pointermove(map.getCanvas(), { pointerId: 'b', clientX: 0, clientY: 5 });

    map._renderTaskQueue.run();

    simulate.pointerup(canvas, { pointerId: 'a' });

    map._renderTaskQueue.run();

    t.assert.equal(move.callCount, 0);

    map.remove();
  });

  await t.test('starts zoom immediately when rotation disabled', t => {
    const map = createMap(t);
    map.touchZoomRotate.disableRotation();

    const zoomstart = t.spy();
    const zoom = t.spy();
    const zoomend = t.spy();

    map.on('zoomstart', zoomstart);
    map.on('zoom', zoom);
    map.on('zoomend', zoomend);

    const canvas = map.getCanvas();
    simulate.pointerdown(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
    simulate.pointerdown(canvas, { pointerId: 'b', clientX: 0, clientY: 5 });

    map._renderTaskQueue.run();
    t.assert.equal(zoomstart.callCount, 0);
    t.assert.equal(zoom.callCount, 0);
    t.assert.equal(zoomend.callCount, 0);

    simulate.pointermove(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
    simulate.pointermove(canvas, { pointerId: 'b', clientX: 0, clientY: 6 });

    map._renderTaskQueue.run();
    t.assert.equal(zoomstart.callCount, 1);
    t.assert.equal(zoom.callCount, 1);
    t.assert.equal(zoomend.callCount, 0);

    simulate.pointermove(canvas, { pointerId: 'a', clientX: 0, clientY: -5 });
    simulate.pointermove(canvas, { pointerId: 'b', clientX: 0, clientY: 5 });

    map._renderTaskQueue.run();
    t.assert.equal(zoomstart.callCount, 1);
    t.assert.equal(zoom.callCount, 2);
    t.assert.equal(zoomend.callCount, 0);

    simulate.pointerup(canvas, { pointerId: 'a' });

    map._renderTaskQueue.run();
    t.assert.equal(zoomstart.callCount, 1);
    t.assert.equal(zoom.callCount, 2);
    t.assert.equal(zoomend.callCount, 1);

    map.remove();
  });
});
