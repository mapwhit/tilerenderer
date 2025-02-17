const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../..//util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');

function createMap(options) {
  return new Map(Object.assign({ container: DOM.create('div', '', window.document.body) }, options));
}

test('DragRotateHandler', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test(
    'fires rotatestart, rotate, and rotateend events at appropriate times in response to a right-click drag',
    t => {
      const map = createMap();

      const rotatestart = t.spy();
      const rotate = t.spy();
      const rotateend = t.spy();

      map.on('rotatestart', rotatestart);
      map.on('rotate', rotate);
      map.on('rotateend', rotateend);

      simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 0);
      t.assert.equal(rotate.callCount, 0);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointermove(map.getCanvas(), { buttons: 2 });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 1);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 1);
      t.assert.equal(rotateend.callCount, 1);

      map.remove();
    }
  );

  await t.test('stops firing events after mouseup', t => {
    const map = createMap();

    const spy = t.spy();
    map.on('rotatestart', spy);
    map.on('rotate', spy);
    map.on('rotateend', spy);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    t.assert.equal(spy.callCount, 3);

    spy.resetHistory();
    simulate.pointermove(map.getCanvas(), { buttons: 0 });
    map._renderTaskQueue.run();
    t.assert.equal(spy.callCount, 0);

    map.remove();
  });

  await t.test(
    'fires rotatestart, rotate, and rotateend events at appropriate times in response to a control-left-click drag',
    t => {
      const map = createMap();

      const rotatestart = t.spy();
      const rotate = t.spy();
      const rotateend = t.spy();

      map.on('rotatestart', rotatestart);
      map.on('rotate', rotate);
      map.on('rotateend', rotateend);

      simulate.pointerdown(map.getCanvas(), { buttons: 1, button: 0, ctrlKey: true });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 0);
      t.assert.equal(rotate.callCount, 0);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointermove(map.getCanvas(), { buttons: 1, ctrlKey: true });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 1);
      t.assert.equal(rotateend.callCount, 0);

      simulate.pointerup(map.getCanvas(), { buttons: 0, button: 0, ctrlKey: true });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 1);
      t.assert.equal(rotateend.callCount, 1);

      map.remove();
    }
  );

  await t.test('pitches in response to a right-click drag by default', t => {
    const map = createMap();

    const pitchstart = t.spy();
    const pitch = t.spy();
    const pitchend = t.spy();

    map.on('pitchstart', pitchstart);
    map.on('pitch', pitch);
    map.on('pitchend', pitchend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(pitchstart.callCount, 1);
    t.assert.equal(pitch.callCount, 1);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    t.assert.equal(pitchend.callCount, 1);

    map.remove();
  });

  await t.test('pitches in response to a control-left-click drag', t => {
    const map = createMap();

    const pitchstart = t.spy();
    const pitch = t.spy();
    const pitchend = t.spy();

    map.on('pitchstart', pitchstart);
    map.on('pitch', pitch);
    map.on('pitchend', pitchend);

    simulate.pointerdown(map.getCanvas(), { buttons: 1, button: 0, ctrlKey: true });
    simulate.pointermove(map.getCanvas(), { buttons: 1, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(pitchstart.callCount, 1);
    t.assert.equal(pitch.callCount, 1);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 0, ctrlKey: true });
    t.assert.equal(pitchend.callCount, 1);

    map.remove();
  });

  await t.test('does not pitch if given pitchWithRotate: false', t => {
    const map = createMap({ pitchWithRotate: false });

    const spy = t.spy();

    map.on('pitchstart', spy);
    map.on('pitch', spy);
    map.on('pitchend', spy);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });

    simulate.pointerdown(map.getCanvas(), { buttons: 1, button: 0, ctrlKey: true });
    simulate.pointermove(map.getCanvas(), { buttons: 1, ctrlKey: true });
    map._renderTaskQueue.run();
    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 0, ctrlKey: true });

    t.assert.ok(spy.notCalled);

    map.remove();
  });

  await t.test('does not rotate or pitch when disabled', t => {
    const map = createMap();

    map.dragRotate.disable();

    const spy = t.spy();

    map.on('rotatestart', spy);
    map.on('rotate', spy);
    map.on('rotateend', spy);
    map.on('pitchstart', spy);
    map.on('pitch', spy);
    map.on('pitchend', spy);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });

    t.assert.ok(spy.notCalled);

    map.remove();
  });

  await t.test('ensures that map.isMoving() returns true during drag', t => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({ bearingSnap: 0 });

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    t.assert.ok(map.isMoving());

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    t.assert.ok(!map.isMoving());

    map.remove();
  });

  await t.test('fires move events', t => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({ bearingSnap: 0 });

    const movestart = t.spy();
    const move = t.spy();
    const moveend = t.spy();

    map.on('movestart', movestart);
    map.on('move', move);
    map.on('moveend', moveend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(movestart.callCount, 1);
    t.assert.equal(move.callCount, 1);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    t.assert.equal(moveend.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler includes originalEvent property in triggered events', t => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({ bearingSnap: 0 });

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();
    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    const pitchstart = t.spy();
    const pitch = t.spy();
    const pitchend = t.spy();
    map.on('pitchstart', pitchstart);
    map.on('pitch', pitch);
    map.on('pitchend', pitchend);

    const movestart = t.spy();
    const move = t.spy();
    const moveend = t.spy();
    map.on('movestart', movestart);
    map.on('move', move);
    map.on('moveend', moveend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });

    t.assert.ok(rotatestart.firstCall.args[0].originalEvent.type, 'mousemove');
    t.assert.ok(pitchstart.firstCall.args[0].originalEvent.type, 'mousemove');
    t.assert.ok(movestart.firstCall.args[0].originalEvent.type, 'mousemove');

    t.assert.ok(rotate.firstCall.args[0].originalEvent.type, 'mousemove');
    t.assert.ok(pitch.firstCall.args[0].originalEvent.type, 'mousemove');
    t.assert.ok(move.firstCall.args[0].originalEvent.type, 'mousemove');

    t.assert.ok(rotateend.firstCall.args[0].originalEvent.type, 'mouseup');
    t.assert.ok(pitchend.firstCall.args[0].originalEvent.type, 'mouseup');
    t.assert.ok(moveend.firstCall.args[0].originalEvent.type, 'mouseup');

    map.remove();
  });

  await t.test('DragRotateHandler responds to events on the canvas container (#1301)', t => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvasContainer(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvasContainer(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);

    simulate.pointerup(map.getCanvasContainer(), { buttons: 0, button: 2 });
    t.assert.equal(rotateend.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler prevents mousemove events from firing during a drag (#1555)', t => {
    const map = createMap();

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.pointerdown(map.getCanvasContainer(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvasContainer(), { buttons: 2 });
    map._renderTaskQueue.run();
    simulate.pointerup(map.getCanvasContainer(), { buttons: 0, button: 2 });

    t.assert.ok(mousemove.notCalled);

    map.remove();
  });

  await t.test(
    'DragRotateHandler ends a control-left-click drag on mouseup even when the control key was previously released (#1888)',
    t => {
      const map = createMap();

      const rotatestart = t.spy();
      const rotate = t.spy();
      const rotateend = t.spy();

      map.on('rotatestart', rotatestart);
      map.on('rotate', rotate);
      map.on('rotateend', rotateend);

      simulate.pointerdown(map.getCanvas(), { buttons: 1, button: 0, ctrlKey: true });
      simulate.pointermove(map.getCanvas(), { buttons: 1, ctrlKey: true });
      map._renderTaskQueue.run();
      t.assert.equal(rotatestart.callCount, 1);
      t.assert.equal(rotate.callCount, 1);

      simulate.pointerup(map.getCanvas(), { buttons: 0, button: 0, ctrlKey: false });
      t.assert.equal(rotateend.callCount, 1);

      map.remove();
    }
  );

  await t.test('DragRotateHandler ends rotation if the window blurs (#3389)', t => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);

    simulate.blur(window);
    t.assert.equal(rotateend.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler requests a new render frame after each mousemove event', t => {
    const map = createMap();
    const requestRenderFrame = t.spy(map, '_requestRenderFrame');

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    t.assert.ok(requestRenderFrame.callCount > 0);

    map._renderTaskQueue.run();

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    requestRenderFrame.resetHistory();
    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    t.assert.equal(requestRenderFrame.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler can interleave with another handler', t => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    // simulates another handler taking over
    // simulate a scroll zoom
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -simulate.magicWheelZoomDelta });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 2);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 2);
    t.assert.equal(rotateend.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler does not begin a drag on left-button mousedown without the control key', t => {
    const map = createMap();
    map.dragPan.disable();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerup(map.getCanvas());
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    map.remove();
  });

  await t.test('DragRotateHandler does not end a right-button drag on left-button mouseup', t => {
    const map = createMap();
    map.dragPan.disable();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerdown(map.getCanvas(), { buttons: 3, button: 0 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 2, button: 0 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 2);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 2);
    t.assert.equal(rotateend.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler does not end a control-left-button drag on right-button mouseup', t => {
    const map = createMap();
    map.dragPan.disable();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas(), { buttons: 1, button: 0, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 1, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerdown(map.getCanvas(), { buttons: 3, button: 2, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 1, button: 2, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 1);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointermove(map.getCanvas(), { buttons: 1, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 2);
    t.assert.equal(rotateend.callCount, 0);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 0, ctrlKey: true });
    map._renderTaskQueue.run();
    t.assert.equal(rotatestart.callCount, 1);
    t.assert.equal(rotate.callCount, 2);
    t.assert.equal(rotateend.callCount, 1);

    map.remove();
  });

  await t.test('DragRotateHandler does not begin a drag if preventDefault is called on the mousedown event', t => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();

    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);

    map.remove();
  });

  await Promise.all(
    ['rotatestart', 'rotate'].map(async event => {
      await t.test(`DragRotateHandler can be disabled on ${event} (#2419)`, t => {
        const map = createMap();

        map.on(event, () => map.dragRotate.disable());

        const rotatestart = t.spy();
        const rotate = t.spy();
        const rotateend = t.spy();

        map.on('rotatestart', rotatestart);
        map.on('rotate', rotate);
        map.on('rotateend', rotateend);

        simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
        map._renderTaskQueue.run();

        simulate.pointermove(map.getCanvas(), { buttons: 2 });
        map._renderTaskQueue.run();

        t.assert.equal(rotatestart.callCount, 1);
        t.assert.equal(rotate.callCount, event === 'rotatestart' ? 0 : 1);
        t.assert.equal(rotateend.callCount, 1);
        t.assert.equal(map.isMoving(), false);
        t.assert.equal(map.dragRotate.isEnabled(), false);

        simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
        map._renderTaskQueue.run();

        t.assert.equal(rotatestart.callCount, 1);
        t.assert.equal(rotate.callCount, event === 'rotatestart' ? 0 : 1);
        t.assert.equal(rotateend.callCount, 1);
        t.assert.equal(map.isMoving(), false);
        t.assert.equal(map.dragRotate.isEnabled(), false);

        map.remove();
      });
    })
  );

  await t.test('DragRotateHandler can be disabled after mousedown (#2419)', t => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate = t.spy();
    const rotateend = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate', rotate);
    map.on('rotateend', rotateend);

    simulate.pointerdown(map.getCanvas(), { buttons: 2, button: 2 });
    map._renderTaskQueue.run();

    map.dragRotate.disable();

    simulate.pointermove(map.getCanvas(), { buttons: 2 });
    map._renderTaskQueue.run();

    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);
    t.assert.equal(map.isMoving(), false);
    t.assert.equal(map.dragRotate.isEnabled(), false);

    simulate.pointerup(map.getCanvas(), { buttons: 0, button: 2 });
    map._renderTaskQueue.run();

    t.assert.equal(rotatestart.callCount, 0);
    t.assert.equal(rotate.callCount, 0);
    t.assert.equal(rotateend.callCount, 0);
    t.assert.equal(map.isMoving(), false);
    t.assert.equal(map.dragRotate.isEnabled(), false);

    map.remove();
  });
});
