const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');

function createMap() {
  return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('DragPanHandler', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test(
    'DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag',
    t => {
      const map = createMap();

      const dragstart = t.spy();
      const drag = t.spy();
      const dragend = t.spy();

      map.on('dragstart', dragstart);
      map.on('drag', drag);
      map.on('dragend', dragend);

      simulate.pointerdown(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 0);
      t.assert.equal(drag.callCount, 0);
      t.assert.equal(dragend.callCount, 0);

      simulate.pointermove(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 0);

      simulate.pointerup(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 1);

      map.remove();
    }
  );

  await t.test(
    'DragPanHandler captures mousemove events during a mouse-triggered drag (receives them even if they occur outside the map)',
    t => {
      const map = createMap();

      const dragstart = t.spy();
      const drag = t.spy();
      const dragend = t.spy();

      map.on('dragstart', dragstart);
      map.on('drag', drag);
      map.on('dragend', dragend);

      simulate.pointerdown(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 0);
      t.assert.equal(drag.callCount, 0);
      t.assert.equal(dragend.callCount, 0);

      simulate.pointermove(window.document.body);
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 0);

      simulate.pointerup(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 1);

      map.remove();
    }
  );

  await t.test(
    'DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag',
    t => {
      const map = createMap();

      const dragstart = t.spy();
      const drag = t.spy();
      const dragend = t.spy();

      map.on('dragstart', dragstart);
      map.on('drag', drag);
      map.on('dragend', dragend);

      simulate.touchstart(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 0);
      t.assert.equal(drag.callCount, 0);
      t.assert.equal(dragend.callCount, 0);

      simulate.touchmove(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 0);

      simulate.touchend(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 1);

      map.remove();
    }
  );

  await t.test(
    'DragPanHandler captures touchmove events during a mouse-triggered drag (receives them even if they occur outside the map)',
    t => {
      const map = createMap();

      const dragstart = t.spy();
      const drag = t.spy();
      const dragend = t.spy();

      map.on('dragstart', dragstart);
      map.on('drag', drag);
      map.on('dragend', dragend);

      simulate.touchstart(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 0);
      t.assert.equal(drag.callCount, 0);
      t.assert.equal(dragend.callCount, 0);

      simulate.touchmove(window.document.body);
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 0);

      simulate.touchend(map.getCanvas());
      map._renderTaskQueue.run();
      t.assert.equal(dragstart.callCount, 1);
      t.assert.equal(drag.callCount, 1);
      t.assert.equal(dragend.callCount, 1);

      map.remove();
    }
  );

  await t.test('DragPanHandler prevents mousemove events from firing during a drag (#1555)', t => {
    const map = createMap();

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.pointerdown(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.pointerup(map.getCanvasContainer());
    map._renderTaskQueue.run();

    t.assert.ok(mousemove.notCalled);

    map.remove();
  });

  await t.test('DragPanHandler ends a mouse-triggered drag if the window blurs', t => {
    const map = createMap();

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.blur(window);
    t.assert.equal(dragend.callCount, 1);

    map.remove();
  });

  await t.test('DragPanHandler ends a touch-triggered drag if the window blurs', t => {
    const map = createMap();

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.blur(window);
    t.assert.equal(dragend.callCount, 1);

    map.remove();
  });

  await t.test('DragPanHandler requests a new render frame after each mousemove event', t => {
    const map = createMap();
    const requestFrame = t.spy(map, '_requestRenderFrame');

    simulate.pointerdown(map.getCanvas());
    simulate.pointermove(map.getCanvas());
    t.assert.ok(requestFrame.callCount > 0);

    map._renderTaskQueue.run();

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    requestFrame.resetHistory();
    simulate.pointermove(map.getCanvas());
    t.assert.equal(requestFrame.callCount, 1);

    map.remove();
  });

  await t.test('DragPanHandler can interleave with another handler', t => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 1);
    t.assert.equal(dragend.callCount, 0);

    // simulate a scroll zoom
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -simulate.magicWheelZoomDelta });
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 1);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 2);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointerup(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 2);
    t.assert.equal(dragend.callCount, 1);

    map.remove();
  });

  await Promise.all(
    ['ctrl', 'shift'].map(async modifier => {
      await t.test(`DragPanHandler does not begin a drag if the ${modifier} key is down on mousedown`, t => {
        const map = createMap();
        map.dragRotate.disable();

        const dragstart = t.spy();
        const drag = t.spy();
        const dragend = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag', drag);
        map.on('dragend', dragend);

        simulate.pointerdown(map.getCanvas(), { [`${modifier}Key`]: true });
        map._renderTaskQueue.run();
        t.assert.equal(dragstart.callCount, 0);
        t.assert.equal(drag.callCount, 0);
        t.assert.equal(dragend.callCount, 0);

        simulate.pointermove(map.getCanvas(), { [`${modifier}Key`]: true });
        map._renderTaskQueue.run();
        t.assert.equal(dragstart.callCount, 0);
        t.assert.equal(drag.callCount, 0);
        t.assert.equal(dragend.callCount, 0);

        simulate.pointerup(map.getCanvas(), { [`${modifier}Key`]: true });
        map._renderTaskQueue.run();
        t.assert.equal(dragstart.callCount, 0);
        t.assert.equal(drag.callCount, 0);
        t.assert.equal(dragend.callCount, 0);

        map.remove();
      });

      await t.test(`DragPanHandler still ends a drag if the ${modifier} key is down on mouseup`, t => {
        const map = createMap();
        map.dragRotate.disable();

        const dragstart = t.spy();
        const drag = t.spy();
        const dragend = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag', drag);
        map.on('dragend', dragend);

        simulate.pointerdown(map.getCanvas());
        map._renderTaskQueue.run();
        t.assert.equal(dragstart.callCount, 0);
        t.assert.equal(drag.callCount, 0);
        t.assert.equal(dragend.callCount, 0);

        simulate.pointerup(map.getCanvas(), { [`${modifier}Key`]: true });
        map._renderTaskQueue.run();
        t.assert.equal(dragstart.callCount, 0);
        t.assert.equal(drag.callCount, 0);
        t.assert.equal(dragend.callCount, 0);

        simulate.pointermove(map.getCanvas());
        map._renderTaskQueue.run();
        t.assert.equal(dragstart.callCount, 0);
        t.assert.equal(drag.callCount, 0);
        t.assert.equal(dragend.callCount, 0);

        map.remove();
      });
    })
  );

  await t.test('DragPanHandler does not begin a drag on right button mousedown', t => {
    const map = createMap();
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    map.remove();
  });

  await t.test('DragPanHandler does not end a drag on right button mouseup', t => {
    const map = createMap();
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 1);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 1);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 1);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 2);
    t.assert.equal(dragend.callCount, 0);

    simulate.pointerup(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(dragstart.callCount, 1);
    t.assert.equal(drag.callCount, 2);
    t.assert.equal(dragend.callCount, 1);

    map.remove();
  });

  await t.test('DragPanHandler does not begin a drag if preventDefault is called on the mousedown event', t => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.pointerup(map.getCanvas());
    map._renderTaskQueue.run();

    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    map.remove();
  });

  await t.test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event', t => {
    const map = createMap();

    map.on('touchstart', e => e.preventDefault());

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();

    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);

    map.remove();
  });

  await Promise.all(
    ['dragstart', 'drag'].forEach(async event => {
      await t.test(`DragPanHandler can be disabled on ${event} (#2419)`, t => {
        const map = createMap();

        map.on(event, () => map.dragPan.disable());

        const dragstart = t.spy();
        const drag = t.spy();
        const dragend = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag', drag);
        map.on('dragend', dragend);

        simulate.pointerdown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.pointermove(map.getCanvas());
        map._renderTaskQueue.run();

        t.assert.equal(dragstart.callCount, 1);
        t.assert.equal(drag.callCount, event === 'dragstart' ? 0 : 1);
        t.assert.equal(dragend.callCount, 1);
        t.assert.equal(map.isMoving(), false);
        t.assert.equal(map.dragPan.isEnabled(), false);

        simulate.pointerup(map.getCanvas());
        map._renderTaskQueue.run();

        t.assert.equal(dragstart.callCount, 1);
        t.assert.equal(drag.callCount, event === 'dragstart' ? 0 : 1);
        t.assert.equal(dragend.callCount, 1);
        t.assert.equal(map.isMoving(), false);
        t.assert.equal(map.dragPan.isEnabled(), false);

        map.remove();
      });
    })
  );

  await t.test('DragPanHandler can be disabled after mousedown (#2419)', t => {
    const map = createMap();

    const dragstart = t.spy();
    const drag = t.spy();
    const dragend = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);

    simulate.pointerdown(map.getCanvas());
    map._renderTaskQueue.run();

    map.dragPan.disable();

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();

    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);
    t.assert.equal(map.isMoving(), false);
    t.assert.equal(map.dragPan.isEnabled(), false);

    simulate.pointerup(map.getCanvas());
    map._renderTaskQueue.run();

    t.assert.equal(dragstart.callCount, 0);
    t.assert.equal(drag.callCount, 0);
    t.assert.equal(dragend.callCount, 0);
    t.assert.equal(map.isMoving(), false);
    t.assert.equal(map.dragPan.isEnabled(), false);

    map.remove();
  });
});
