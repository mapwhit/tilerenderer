const DOM = require('../../util/dom');

const { bezier } = require('../../util/util');
const { Event } = require('../../util/evented');
const assert = require('assert');
const makeFrame = require('./frame');
const makeInertia = require('./inertia');

const inertiaLinearity = 0.25;
const inertiaEasing = bezier(0, 0, inertiaLinearity, 1);
const inertiaMaxSpeed = 180; // deg/s
const inertiaDeceleration = 720; // deg/s^2

/**
 * The `DragRotateHandler` allows the user to rotate the map by clicking and
 * dragging the cursor while holding the right mouse button or `ctrl` key.
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 * @param {Object} [options]
 * @param {number} [options.bearingSnap] The threshold, measured in degrees, that determines when the map's
 *   bearing will snap to north.
 * @param {bool} [options.pitchWithRotate=true] Control the map pitch in addition to the bearing
 */
function dragRotateHandler(map, { element, button = 'right', bearingSnap = 0, pitchWithRotate = true } = {}) {
  const el = element || map.getCanvasContainer();

  const frame = makeFrame(map, onDragFrame);

  let eventButton;
  let inertia;
  let state = 'disabled';
  let previousPos;
  let previousBearing;

  /**
   * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
   *
   * @returns {boolean} `true` if the "drag to rotate" interaction is enabled.
   */
  function isEnabled() {
    return state !== 'disabled';
  }

  /**
   * Returns a Boolean indicating whether the "drag to rotate" interaction is active, i.e. currently being used.
   *
   * @returns {boolean} `true` if the "drag to rotate" interaction is active.
   */
  function isActive() {
    return state === 'active';
  }

  /**
   * Enables the "drag to rotate" interaction.
   *
   * @example
   * map.dragRotate.enable();
   */
  function enable() {
    if (isEnabled()) return;
    state = 'enabled';
  }

  /**
   * Disables the "drag to rotate" interaction.
   *
   * @example
   * map.dragRotate.disable();
   */
  function disable() {
    if (!isEnabled()) return;
    switch (state) {
      case 'active':
        state = 'disabled';
        unbind();
        deactivate();
        fireEvent('rotateend');
        if (pitchWithRotate) fireEvent('pitchend');
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

    if (button === 'right') {
      eventButton = DOM.mouseButton(e);
      if (eventButton !== (e.ctrlKey ? 0 : 2)) return;
    } else {
      if (e.ctrlKey || DOM.mouseButton(e) !== 0) return;
      eventButton = 0;
    }

    DOM.disableDrag();

    // Bind window-level event listeners for move and up/end events. In the absence of
    // the pointer capture API, which is not supported by all necessary platforms,
    // window-level event listeners give us the best shot at capturing events that
    // fall outside the map canvas element. Use `{capture: true}` for the move event
    // to prevent map move events from being fired during a drag.
    window.document.addEventListener('pointermove', onPointerMove, { capture: true });
    window.document.addEventListener('pointerup', onPointerUp);

    // Deactivate when the window loses focus. Otherwise if a pointerup occurs when the window
    // isn't in focus, dragging will continue even though the mouse is no longer pressed.
    window.addEventListener('blur', onBlur);

    state = 'pending';

    previousPos = DOM.pointerPos(el, e);
    previousBearing = map.getBearing();

    inertia = makeInertia(map, calculateInertia);
    inertia.update(previousBearing);

    e.preventDefault();
  }

  function onPointerMove(e) {
    const pos = DOM.pointerPos(el, e);
    frame.request(e, pos);

    if (state === 'pending') {
      state = 'active';
      fireEvent('rotatestart', e);
      fireEvent('movestart', e);
      if (pitchWithRotate) fireEvent('pitchstart', e);
    }
  }

  function onDragFrame(e, pos) {
    const tr = map.transform;

    const bearingDiff = (pos.x - previousPos.x) * -0.8;
    const pitchDiff = (pos.y - previousPos.y) * 0.5;

    const bearing = tr.bearing - bearingDiff;
    const pitch = tr.pitch - pitchDiff;

    const normalizedBearing = map._normalizeBearing(bearing, previousBearing);
    inertia.update(normalizedBearing);

    tr.bearing = bearing;
    if (pitchWithRotate) {
      fireEvent('pitch', e);
      tr.pitch = pitch;
    }

    fireEvent('rotate', e);
    fireEvent('move', e);

    previousBearing = normalizedBearing;
    previousPos = pos;
  }

  function onPointerUp(e) {
    if (DOM.mouseButton(e) !== eventButton) return;
    switch (state) {
      case 'active':
        state = 'enabled';
        DOM.suppressClick();
        unbind();
        deactivate();
        inertialRotate(e);
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
        fireEvent('rotateend', e);
        if (pitchWithRotate) fireEvent('pitchend', e);
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
    window.document.removeEventListener('pointermove', onPointerMove, { capture: true });
    window.document.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('blur', onBlur);
    DOM.enableDrag();
  }

  function deactivate() {
    frame.cancel();

    previousPos = undefined;
    previousBearing = undefined;
    eventButton = undefined;
  }

  function calculateInertia(first, last) {
    const mapBearing = map.getBearing();
    let bearing = map._normalizeBearing(mapBearing, previousBearing);

    const flingDiff = last.value - first.value;
    const sign = flingDiff < 0 ? -1 : 1;
    const flingDuration = (last.time - first.time) / 1000;

    if (flingDiff === 0 || flingDuration === 0) {
      return { empty: true };
    }

    let speed = Math.abs(flingDiff * (inertiaLinearity / flingDuration)); // deg/s
    if (speed > inertiaMaxSpeed) {
      speed = inertiaMaxSpeed;
    }

    const duration = speed / (inertiaDeceleration * inertiaLinearity);
    const offset = sign * speed * (duration / 2);

    bearing += offset;

    if (Math.abs(map._normalizeBearing(bearing, 0)) < bearingSnap) {
      bearing = map._normalizeBearing(0, bearing);
    }

    return {
      duration: duration * 1000,
      bearing
    };
  }

  function inertialRotate(e) {
    fireEvent('rotateend', e);

    const { empty, bearing, duration } = inertia.calculate();
    if (empty) {
      if (Math.abs(map.getBearing()) < bearingSnap) {
        map.resetNorth({ noMoveStart: true }, { originalEvent: e });
      } else {
        fireEvent('moveend', e);
      }
      if (pitchWithRotate) fireEvent('pitchend', e);
      return;
    }

    map.rotateTo(
      bearing,
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

  DOM.initEnableDisableDrag();

  return {
    isActive,
    isEnabled,
    enable,
    disable,
    onPointerDown
  };
}

module.exports = dragRotateHandler;
