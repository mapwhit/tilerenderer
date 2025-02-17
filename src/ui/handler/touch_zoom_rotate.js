const DOM = require('../../util/dom');
const { bezier } = require('../../util/util');
const { Event } = require('../../util/evented');
const makeFrame = require('./frame');
const makeInertia = require('./inertia');

const INERTIA_LINEARITY = 0.15;
const INERTIA_EASING = bezier(0, 0, INERTIA_LINEARITY, 1);
const INERTIA_DECELERATION = 12; // scale / s^2
const INERTIA_MAX_SPEED = 2.5; // scale / s;

const SIGNIFICANT_SCALE_THRESHOLD = 0.15;
const SIGNIFICANT_ROTATE_THRESHOLD = 10;

function makeMovement(map, { rotationDisabled, aroundCenter }, pointers) {
  const el = map.getCanvasContainer();

  const frame = makeFrame(map, onFrame);

  const { vector: startVector, center } = getVector(pointers.events);
  const startScale = map.transform.scale;
  const startBearing = map.transform.bearing;
  const inertia = makeInertia(map, calculateInertia);

  let gestureIntent;
  let lastCenter = center;
  const around = map.transform.pointLocation(center);

  function onMove(pointers) {
    const { vector, center } = getVector(pointers.events);
    lastCenter = center;

    const scale = vector.mag() / startVector.mag();
    inertia.update(scale);
    const originalEvent = pointers.last;
    frame.request(originalEvent, { vector, scale, center });

    if (gestureIntent) return;

    // Determine 'intent' by whichever threshold is surpassed first,
    // then keep that state for the duration of this gesture.
    if (!rotationDisabled) {
      const bearing = (vector.angleWith(startVector) * 180) / Math.PI;
      if (Math.abs(bearing) > SIGNIFICANT_ROTATE_THRESHOLD) {
        gestureIntent = 'rotate';
      }
    }

    if (!gestureIntent) {
      if (rotationDisabled && scale !== 1) {
        // when rotation is disabled, any scale change triggers the zoom gesture to start
        gestureIntent = 'zoom';
      } else if (Math.abs(1 - scale) > SIGNIFICANT_SCALE_THRESHOLD) {
        gestureIntent = 'zoom';
      }
    }

    if (gestureIntent) {
      map.fire(new Event(`${gestureIntent}start`, { originalEvent }));
      map.fire(new Event('movestart', { originalEvent }));
    }
  }

  function onFrame(originalEvent, { vector, scale, center }) {
    if (!gestureIntent) return;

    if (gestureIntent === 'rotate') {
      const bearing = (vector.angleWith(startVector) * 180) / Math.PI;
      map.transform.bearing = startBearing + bearing;
    }

    map.transform.zoom = map.transform.scaleZoom(startScale * scale);
    map.transform.setLocationAtPoint(around, center);

    map.fire(new Event(gestureIntent, { originalEvent }));
    map.fire(new Event('move', { originalEvent }));
  }

  function onEnd(originalEvent) {
    frame.cancel();

    if (!gestureIntent) return;

    map.fire(new Event(`${gestureIntent}end`, { originalEvent }));

    const { zoom, duration, empty } = inertia.calculate();
    if (empty) {
      map.snapToNorth({}, { originalEvent });
    } else {
      map.easeTo(
        {
          zoom,
          duration,
          easing: INERTIA_EASING,
          around: aroundCenter ? map.getCenter() : map.unproject(lastCenter),
          noMoveStart: true
        },
        { originalEvent }
      );
    }
  }

  function getVector([e0, e1]) {
    const p0 = DOM.pointerPos(el, e0);
    const p1 = DOM.pointerPos(el, e1);

    return {
      vector: p0.sub(p1),
      center: p0.add(p1).div(2)
    };
  }

  function calculateInertia(first, last) {
    const firstZoom = map.transform.scaleZoom(startScale * first.value);
    const lastZoom = map.transform.scaleZoom(startScale * last.value);

    const scaleDuration = (last.time - first.time) / 1000;
    if (scaleDuration === 0 || lastZoom === firstZoom) {
      return { empty: true };
    }

    // calculate scale/s speed and adjust for increased initial animation speed when easing
    let speed = ((lastZoom - firstZoom) * INERTIA_LINEARITY) / scaleDuration; // scale/s
    if (speed > INERTIA_MAX_SPEED) {
      speed = INERTIA_MAX_SPEED;
    } else if (speed < -INERTIA_MAX_SPEED) {
      speed = -INERTIA_MAX_SPEED;
    }

    const duration = Math.abs(speed / (INERTIA_DECELERATION * INERTIA_LINEARITY)) * 1000;
    let zoom = lastZoom + (speed * duration) / 2000;
    if (zoom < 0) {
      zoom = 0;
    }

    return { zoom, duration };
  }

  return {
    onMove,
    onFrame,
    onEnd
  };
}

/**
 * The `TouchZoomRotateHandler` allows the user to zoom and rotate the map by
 * pinching on a touchscreen.
 */
function touchZoomRotateHandler(map) {
  let enabled = false;
  let aroundCenter = false;
  let rotationDisabled = false;

  let movement;

  /**
   * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.
   *
   * @returns {boolean} `true` if the "pinch to rotate and zoom" interaction is enabled.
   */
  function isEnabled() {
    return enabled;
  }

  /**
   * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is active.
   *
   * @returns {boolean} `true` if the "pinch to rotate and zoom" interaction is active.
   */
  function isActive() {
    return !!movement;
  }

  /**
   * Enables the "pinch to rotate and zoom" interaction.
   *
   * @param {Object} [options]
   * @param {string} [options.around] If "center" is passed, map will zoom around the center
   *
   * @example
   *   map.touchZoomRotate.enable();
   * @example
   *   map.touchZoomRotate.enable({ around: 'center' });
   */
  function enable(options) {
    if (enabled) return;
    map.getCanvasContainer().classList.add('mapboxgl-touch-zoom-rotate');
    enabled = true;
    aroundCenter = options?.around === 'center';
  }

  /**
   * Disables the "pinch to rotate and zoom" interaction.
   *
   * @example
   *   map.touchZoomRotate.disable();
   */
  function disable() {
    if (!enabled) return;
    map.getCanvasContainer().classList.remove('mapboxgl-touch-zoom-rotate');
    enabled = false;
  }

  /**
   * Disables the "pinch to rotate" interaction, leaving the "pinch to zoom"
   * interaction enabled.
   *
   * @example
   *   map.touchZoomRotate.disableRotation();
   */
  function disableRotation() {
    rotationDisabled = true;
  }

  /**
   * Enables the "pinch to rotate" interaction.
   *
   * @example
   *   map.touchZoomRotate.enable();
   *   map.touchZoomRotate.enableRotation();
   */
  function enableRotation() {
    rotationDisabled = false;
  }

  function onStart(pointers) {
    if (!enabled) return;
    if (pointers.size !== 2) return;

    movement = makeMovement(map, { rotationDisabled, aroundCenter }, pointers.events);
  }

  function onMove(pointers) {
    if (pointers.size !== 2) return;
    movement?.onMove(pointers.events);
  }

  function onEnd(e) {
    movement?.onEnd(e);
    movement = undefined;
  }

  return {
    isEnabled,
    isActive,
    enable,
    disable,
    enableRotation,
    disableRotation,
    onStart,
    onMove,
    onEnd
  };
}

module.exports = touchZoomRotateHandler;
