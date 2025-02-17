const { Event } = require('../util/evented');

const DOM = require('../util/dom');

class PreventableEvent extends Event {
  #defaultPrevented = false;

  /**
   * Prevents subsequent default processing of the event by the map.
   */
  preventDefault() {
    this.#defaultPrevented = true;
  }

  /**
   * `true` if `preventDefault` has been called.
   */
  get defaultPrevented() {
    return this.#defaultPrevented;
  }
}

class MapPointerEvent extends PreventableEvent {
  /**
   * @param {string} type event type.
   * @param {Object} map the `Map` object that fired the event.
   * @param {MouseEvent} originalEvent The DOM event which caused the map event.
   * @param {Object} [data={}] Additional event data.
   */
  constructor(type, map, originalEvent, data = {}) {
    const container = map.getCanvasContainer();
    const point = DOM.pointerPos(container, originalEvent);
    const lngLat = map.unproject(point);
    super(type, { point, lngLat, originalEvent });
    this.target = map;
  }
}

class MapWheelEvent extends PreventableEvent {
  /**
   * @param {string} type event type.
   * @param {Object} map the `Map` object that fired the event.
   * @param {MouseEvent} originalEvent The DOM event which caused the map event.
   */
  constructor(type, map, originalEvent) {
    super(type, { originalEvent });
    this.target = map;
  }
}

module.exports = {
  MapPointerEvent,
  MapWheelEvent
};
