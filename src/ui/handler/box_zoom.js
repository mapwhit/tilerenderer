const DOM = require('../../util/dom');

const LngLatBounds = require('../../geo/lng_lat_bounds');
const { Event } = require('../../util/evented');

/**
 * The `BoxZoomHandler` allows the user to zoom the map to fit within a bounding box.
 * The bounding box is defined by clicking and holding `shift` while dragging the cursor.
 */
function boxZoomHandler(map) {
  const el = map.getCanvasContainer();
  const container = map.getContainer();

  let enabled = false;
  let active = false;
  let startPos;
  let box;

  /**
   * Returns a Boolean indicating whether the "box zoom" interaction is enabled.
   *
   * @returns {boolean} `true` if the "box zoom" interaction is enabled.
   */
  function isEnabled() {
    return enabled;
  }

  /**
   * Returns a Boolean indicating whether the "box zoom" interaction is active, i.e. currently being used.
   *
   * @returns {boolean} `true` if the "box zoom" interaction is active.
   */
  function isActive() {
    return active;
  }

  /**
   * Enables the "box zoom" interaction.
   *
   * @example
   *   map.boxZoom.enable();
   */
  function enable() {
    enabled = true;
  }

  /**
   * Disables the "box zoom" interaction.
   *
   * @example
   *   map.boxZoom.disable();
   */
  function disable() {
    enabled = false;
  }

  function onPointerDown(e) {
    if (!enabled) return;
    if (!(e.shiftKey && e.button === 0)) return;

    window.document.addEventListener('pointermove', onPointerMove);
    window.document.addEventListener('keydown', onKeyDown);
    window.document.addEventListener('pointerup', onPointerUp);

    DOM.disableDrag();
    startPos = DOM.pointerPos(el, e);
    active = true;
  }

  function onPointerMove(e) {
    const p0 = startPos;
    const p1 = DOM.pointerPos(el, e);

    if (!box) {
      box = DOM.create('div', 'mapboxgl-boxzoom', container);
      container.classList.add('mapboxgl-crosshair');
      fireEvent('boxzoomstart', e);
    }

    const minX = Math.min(p0.x, p1.x);
    const maxX = Math.max(p0.x, p1.x);
    const minY = Math.min(p0.y, p1.y);
    const maxY = Math.max(p0.y, p1.y);

    box.style.transform = `translate(${minX}px,${minY}px)`;
    box.style.width = `${maxX - minX}px`;
    box.style.height = `${maxY - minY}px`;
  }

  function onPointerUp(e) {
    if (e.button !== 0) return;

    const p0 = startPos;
    const p1 = DOM.pointerPos(el, e);

    const bounds = new LngLatBounds().extend(map.unproject(p0)).extend(map.unproject(p1));

    finish();

    DOM.suppressClick();

    if (p0.x === p1.x && p0.y === p1.y) {
      fireEvent('boxzoomcancel', e);
    } else {
      map
        .fitBounds(bounds, { linear: true })
        .fire(new Event('boxzoomend', { originalEvent: e, boxZoomBounds: bounds }));
    }
  }

  function onKeyDown(e) {
    if (e.keyCode === 27) {
      finish();
      fireEvent('boxzoomcancel', e);
    }
  }

  function finish() {
    active = false;

    window.document.removeEventListener('pointermove', onPointerMove);
    window.document.removeEventListener('keydown', onKeyDown);
    window.document.removeEventListener('pointerup', onPointerUp);

    container.classList.remove('mapboxgl-crosshair');

    if (box) {
      box.remove();
      box = undefined;
    }
    startPos = undefined;

    DOM.enableDrag();
  }

  function fireEvent(type, e) {
    return map.fire(new Event(type, { originalEvent: e }));
  }

  DOM.initEnableDisableDrag();

  return {
    isEnabled,
    isActive,
    enable,
    disable,
    onPointerDown
  };
}

module.exports = boxZoomHandler;
