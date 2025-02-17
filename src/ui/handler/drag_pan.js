const assert = require('assert');

const DOM = require('../../util/dom');
const { bezier } = require('../../util/util');
const { Event } = require('../../util/evented');
const makeFrame = require('./frame');
const makeInertia = require('./inertia');

const inertiaLinearity = 0.3;
const inertiaEasing = bezier(0, 0, inertiaLinearity, 1);
const inertiaMaxSpeed = 1400; // px/s
const inertiaDeceleration = 2500; // px/s^2

/**
 * The `DragPanHandler` allows the user to pan the map by clicking and dragging
 * the cursor.
 */
function dragPanHandler(map) {
  const _el = map.getCanvasContainer();
  const frame = makeFrame(map, onDragFrame);

  let state = 'disabled';
  let inertia;
  let previousPos;

  /**
   * Returns a Boolean indicating whether the "drag to pan" interaction is enabled.
   *
   * @returns {boolean} `true` if the "drag to pan" interaction is enabled.
   */
  function isEnabled() {
    return state !== 'disabled';
  }

  /**
   * Returns a Boolean indicating whether the "drag to pan" interaction is active, i.e. currently being used.
   *
   * @returns {boolean} `true` if the "drag to pan" interaction is active.
   */
  function isActive() {
    return state === 'active';
  }

  /**
   * Enables the "drag to pan" interaction.
   *
   * @example
   * map.dragPan.enable();
   */
  function enable() {
    if (isEnabled()) return;
    map.getCanvasContainer().classList.add('mapboxgl-touch-drag-pan');
    state = 'enabled';
  }

  /**
   * Disables the "drag to pan" interaction.
   *
   * @example
   * map.dragPan.disable();
   */
  function disable() {
    if (!isEnabled()) return;
    map.getCanvasContainer().classList.remove('mapboxgl-touch-drag-pan');
    switch (state) {
      case 'active':
        state = 'disabled';
        unbind();
        deactivate();
        fireEvent('dragend');
        fireEvent('moveend');
        break;
      case 'pending':
        state = 'disabled';
        unbind();
        break;
      default:
        state = 'disabled';
        break;
    }
  }

  function onPointerDown(e) {
    if (state !== 'enabled') return;
    if (e.ctrlKey || DOM.mouseButton(e) !== 0) return;

    // Bind window-level event listeners for pointermove/up events. In the absence of
    // the pointer capture API, which is not supported by all necessary platforms,
    // window-level event listeners give us the best shot at capturing events that
    // fall outside the map canvas element. Use `{capture: true}` for the move event
    // to prevent map move events from being fired during a drag.
    window.document.addEventListener('pointermove', onMove, { capture: true });
    window.document.addEventListener('pointerup', onPointerUp);

    start(e);
  }

  function start(e) {
    // Deactivate when the window loses focus. Otherwise if a mouseup occurs when the window
    // isn't in focus, dragging will continue even though the mouse is no longer pressed.
    window.addEventListener('blur', onBlur);

    state = 'pending';
    previousPos = DOM.pointerPos(_el, e);
    inertia = makeInertia(map, calculateInertia);
    inertia.update(previousPos);
  }

  function onMove(e) {
    e.preventDefault();

    const pos = DOM.pointerPos(_el, e);
    inertia.update(pos);
    frame.request(e, pos);

    if (state === 'pending') {
      // we treat the first move event (rather than the mousedown event)
      // as the start of the drag
      state = 'active';
      fireEvent('dragstart', e);
      fireEvent('movestart', e);
    }
  }

  /**
   * Called in each render frame while dragging is happening.
   * @private
   */
  function onDragFrame(e, pos) {
    const tr = map.transform;
    tr.setLocationAtPoint(tr.pointLocation(previousPos), pos);
    fireEvent('drag', e);
    fireEvent('move', e);

    previousPos = pos;
  }

  function onPointerUp(e) {
    if (DOM.mouseButton(e) !== 0) return;
    switch (state) {
      case 'active':
        state = 'enabled';
        DOM.suppressClick();
        unbind();
        deactivate();
        inertialPan(e);
        break;
      case 'pending':
        state = 'enabled';
        unbind();
        break;
      default:
        assert(false);
        break;
    }
  }

  function onBlur(e) {
    switch (state) {
      case 'active':
        state = 'enabled';
        unbind();
        deactivate();
        fireEvent('dragend', e);
        fireEvent('moveend', e);
        break;
      case 'pending':
        state = 'enabled';
        unbind();
        break;
      default:
        assert(false);
        break;
    }
  }

  function unbind() {
    window.document.removeEventListener('pointermove', onMove, { capture: true });
    window.document.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('blur', onBlur);
  }

  function deactivate() {
    frame.cancel();
    previousPos = undefined;
  }

  function calculateInertia(first, last) {
    const flingOffset = last.value.sub(first.value);
    const flingDuration = (last.time - first.time) / 1000;

    if (flingDuration === 0 || last.value.equals(first.value)) {
      return { empty: true };
    }

    // calculate px/s velocity & adjust for increased initial animation speed when easing out
    const velocity = flingOffset.mult(inertiaLinearity / flingDuration);
    let speed = velocity.mag(); // px/s

    if (speed > inertiaMaxSpeed) {
      speed = inertiaMaxSpeed;
      velocity._unit()._mult(speed);
    }

    const duration = speed / (inertiaDeceleration * inertiaLinearity);
    const offset = velocity.mult(-duration / 2);

    return {
      duration: duration * 1000,
      offset
    };
  }

  function inertialPan(e) {
    fireEvent('dragend', e);

    const { empty, duration, offset } = inertia.calculate();
    inertia = undefined;

    if (empty) {
      fireEvent('moveend', e);
      return;
    }

    map.panBy(
      offset,
      {
        duration,
        easing: inertiaEasing,
        noMoveStart: true
      },
      { originalEvent: e }
    );
  }

  function fireEvent(type, e) {
    return map.fire(new Event(type, e ? { originalEvent: e } : {}));
  }

  return {
    isActive,
    isEnabled,
    enable,
    disable,
    onPointerDown
  };
}

module.exports = dragPanHandler;
