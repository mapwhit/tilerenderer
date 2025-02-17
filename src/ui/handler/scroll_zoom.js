const DOM = require('../../util/dom');

const browser = require('../../util/browser');
const interpolate = require('../../util/interpolate');
const { Event } = require('../../util/evented');
const makeFrame = require('./frame');

// deltaY value for mouse scroll wheel identification
const wheelZoomDelta = 4.000244140625;
// These magic numbers control the rate of zoom. Trackpad events fire at a greater
// frequency than mouse scroll wheel, so reduce the zoom rate per wheel tick
const defaultZoomRate = 1 / 100;
const wheelZoomRate = 1 / 450;

// upper bound on how much we scale the map in any single render frame; this
// is used to limit zoom rate in the case of very fast scrolling
const maxScalePerFrame = 2;

function computeSmoothOutEasing() {
  const { ease, bezier } = require('../../util/util');
  let _prevEase;

  function compute(duration) {
    let easing = ease;

    if (_prevEase) {
      const t = (browser.now() - _prevEase.start) / _prevEase.duration;
      const speed = _prevEase.easing(t + 0.01) - _prevEase.easing(t);

      // Quick hack to make new bezier that is continuous with last
      const x = (0.27 / Math.sqrt(speed * speed + 0.0001)) * 0.01;
      const y = Math.sqrt(0.27 * 0.27 - x * x);

      easing = bezier(x, y, 0.25, 1);
    }

    _prevEase = {
      start: browser.now(),
      duration,
      easing
    };

    return easing;
  }

  return compute;
}

/**
 * The `ScrollZoomHandler` allows the user to zoom the map by scrolling.
 */
function scrollZoomHandler(_map) {
  // used for delayed-handling of a single wheel movement
  // used to delay final '{move,zoom}end' events

  let _delta = 0;

  let enabled = false;
  let active = false;
  let zooming = false;
  let aroundCenter;

  let _lastWheelEvent;
  let _lastWheelEventTime = 0;
  let _lastValue = 0;

  let _timeout;
  let _finishTimeout;

  let _type;
  let _around;
  let _aroundPoint;

  let _startZoom;
  let _targetZoom;
  let _easing;

  const frame = makeFrame(_map, onScrollFrame);
  const smoothOutEasing = computeSmoothOutEasing();

  /**
   * Returns a Boolean indicating whether the "scroll to zoom" interaction is enabled.
   *
   * @returns {boolean} `true` if the "scroll to zoom" interaction is enabled.
   */
  function isEnabled() {
    return enabled;
  }

  function isActive() {
    return active;
  }

  function isZooming() {
    return zooming;
  }

  /**
   * Enables the "scroll to zoom" interaction.
   *
   * @param {Object} [options]
   * @param {string} [options.around] If "center" is passed, map will zoom around center of map
   *
   * @example
   *   map.scrollZoom.enable();
   * @example
   *  map.scrollZoom.enable({ around: 'center' })
   */
  function enable(options) {
    if (enabled) return;
    enabled = true;
    aroundCenter = options && options.around === 'center';
  }

  /**
   * Disables the "scroll to zoom" interaction.
   *
   * @example
   *   map.scrollZoom.disable();
   */
  function disable() {
    enabled = false;
  }

  function onWheel(e) {
    if (!enabled) return;

    let value = e.deltaMode === window.WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
    const now = browser.now();
    const timeDelta = now - _lastWheelEventTime;

    _lastWheelEventTime = now;
    _lastWheelEvent = e;

    if (value !== 0 && value % wheelZoomDelta === 0) {
      // This one is definitely a mouse wheel event.
      _type = 'wheel';
    } else if (value !== 0 && Math.abs(value) < 4) {
      // This one is definitely a trackpad event because it is so small.
      _type = 'trackpad';
    } else if (timeDelta > 400) {
      // This is likely a new scroll action.
      _type = undefined;
      _lastValue = value;

      // Start a timeout in case this was a singular event, and dely it by up to 40ms.
      _timeout = setTimeout(onTimeout, 40);
    } else if (!_type) {
      // This is a repeating event, but we don't know the type of event just yet.
      // If the delta per time is small, we assume it's a fast trackpad; otherwise we switch into wheel mode.
      _type = Math.abs(timeDelta * value) < 200 ? 'trackpad' : 'wheel';

      // Make sure our delayed event isn't fired again, because we accumulate
      // the previous event (which was less than 40ms ago) into this event.
      if (_timeout) {
        clearTimeout(_timeout);
        _timeout = undefined;
        value += _lastValue;
      }
    }

    // Slow down zoom if shift key is held for more precise zooming
    if (e.shiftKey && value) value = value / 4;

    // Only fire the callback if we actually know what type of scrolling device the user uses.
    if (_type) {
      _delta -= value;
      if (!active) {
        start(e);
      }
    }

    e.preventDefault();
  }

  function onTimeout() {
    _timeout = undefined;
    _type = 'wheel';
    _delta -= _lastValue;
    if (!active) {
      start();
    }
  }

  function start() {
    if (!_delta) return;

    frame.cancel();
    active = true;

    if (!zooming) {
      zooming = true;
      _map.fire(new Event('movestart', { originalEvent: _lastWheelEvent }));
      _map.fire(new Event('zoomstart', { originalEvent: _lastWheelEvent }));
    }

    if (_finishTimeout) {
      clearTimeout(_finishTimeout);
    }

    if (aroundCenter) {
      _around = _map.getCenter();
      _aroundPoint = _map.transform.locationPoint(_around);
    } else {
      _aroundPoint = DOM.pointerPos(_map.getCanvasContainer(), _lastWheelEvent);
      _around = _map.unproject(_aroundPoint);
    }
    frame.request();
  }

  function onScrollFrame() {
    if (!active) return;
    const tr = _map.transform;

    // if we've had scroll events since the last render frame, consume the
    // accumulated delta, and update the target zoom level accordingly
    if (_delta !== 0) {
      // For trackpad events and single mouse wheel ticks, use the default zoom rate
      const zoomRate = _type === 'wheel' && Math.abs(_delta) > wheelZoomDelta ? wheelZoomRate : defaultZoomRate;
      // Scale by sigmoid of scroll wheel delta.
      let scale = maxScalePerFrame / (1 + Math.exp(-Math.abs(_delta * zoomRate)));

      if (_delta < 0 && scale !== 0) {
        scale = 1 / scale;
      }

      const fromScale = typeof _targetZoom === 'number' ? tr.zoomScale(_targetZoom) : tr.scale;
      _targetZoom = Math.min(tr.maxZoom, Math.max(tr.minZoom, tr.scaleZoom(fromScale * scale)));

      // if this is a mouse wheel, refresh the starting zoom and easing
      // function we're using to smooth out the zooming between wheel
      // events
      if (_type === 'wheel') {
        _startZoom = tr.zoom;
        _easing = smoothOutEasing(200);
      }

      _delta = 0;
    }

    const targetZoom = typeof _targetZoom === 'number' ? _targetZoom : tr.zoom;
    let finished = false;
    if (_type === 'wheel' && _startZoom && _easing) {
      const t = Math.min((browser.now() - _lastWheelEventTime) / 200, 1);
      const k = _easing(t);
      tr.zoom = interpolate(_startZoom, targetZoom, k);
      if (t < 1) {
        frame.request();
      } else {
        finished = true;
      }
    } else {
      tr.zoom = targetZoom;
      finished = true;
    }

    tr.setLocationAtPoint(_around, _aroundPoint);

    _map.fire(new Event('move', { originalEvent: _lastWheelEvent }));
    _map.fire(new Event('zoom', { originalEvent: _lastWheelEvent }));

    if (finished) {
      active = false;
      _finishTimeout = setTimeout(() => {
        zooming = false;
        _finishTimeout = undefined;
        _map.fire(new Event('zoomend', { originalEvent: _lastWheelEvent }));
        _map.fire(new Event('moveend', { originalEvent: _lastWheelEvent }));
        _targetZoom = undefined;
      }, 200);
    }
  }

  return {
    isActive,
    isZooming,
    isEnabled,
    enable,
    disable,
    onWheel
  };
}

module.exports = scrollZoomHandler;
