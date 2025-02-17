const { MapPointerEvent, MapWheelEvent } = require('../ui/events');
const DOM = require('../util/dom');
const scrollZoom = require('./handler/scroll_zoom');
const boxZoom = require('./handler/box_zoom');
const dragRotate = require('./handler/drag_rotate');
const dragPan = require('./handler/drag_pan');
const keyboard = require('./handler/keyboard');
const doubleClickZoom = require('./handler/dblclick_zoom');
const touchZoomRotate = require('./handler/touch_zoom_rotate');

const handlers = {
  scrollZoom,
  boxZoom,
  dragRotate,
  dragPan,
  keyboard,
  doubleClickZoom,
  touchZoomRotate
};

module.exports = function bindHandlers(map, options) {
  const el = map.getCanvasContainer();
  const pointers = makePointerCache();
  let contextMenuEvent = null;
  let startPos = null;

  Object.entries(handlers).forEach(([name, handler]) => {
    map[name] = handler(map, options);
    if (options.interactive && options[name]) {
      map[name].enable(options[name]);
    }
  });

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerover', onPointerOver);
  el.addEventListener('pointerout', onPointerOut);
  el.addEventListener('pointercancel', onPointerCancel);

  el.addEventListener('click', onClick);
  el.addEventListener('dblclick', onDblClick);
  el.addEventListener('contextmenu', onContextMenu);
  el.addEventListener('wheel', onWheel, { passive: false });

  function onPointerDown(e) {
    pointers.down(e);
    startPos = DOM.pointerPos(el, e);

    const mapEvent = new MapPointerEvent('pointerdown', map, e);
    map.fire(mapEvent);

    if (mapEvent.defaultPrevented) {
      return;
    }

    if (options.interactive && !map.doubleClickZoom.isActive()) {
      map.stop();
    }

    if (pointers.size === 1) {
      map.boxZoom.onPointerDown(e);

      if (!map.boxZoom.isActive()) {
        if (!map.dragPan.isActive()) {
          map.dragRotate.onPointerDown(e);
        }

        if (!map.dragRotate.isActive()) {
          map.dragPan.onPointerDown(e);
        }
      }
    }

    if (pointers.size > 1) {
      map.touchZoomRotate.onStart(pointers);
    }
  }

  function onPointerUp(e) {
    const rotating = map.dragRotate.isActive();

    if (contextMenuEvent && !rotating) {
      // This will be the case for Mac
      map.fire(new MapPointerEvent('contextmenu', map, contextMenuEvent));
    }

    pointers.up(e);
    contextMenuEvent = null;

    if (map.touchZoomRotate.isActive()) {
      map.touchZoomRotate.onEnd(e);
    }

    map.fire(new MapPointerEvent('pointerup', map, e));
  }

  function onPointerMove(e) {
    pointers.down(e);

    if (map.dragPan.isActive()) return;
    if (map.dragRotate.isActive()) return;
    if (pointers.size > 1 && map.touchZoomRotate.isActive()) {
      map.touchZoomRotate.onMove(pointers);
      return;
    }

    // FIXME: why? touch move did not have that
    let target = e.target;
    while (target && target !== el) target = target.parentNode;
    if (target !== el) return;

    map.fire(new MapPointerEvent('pointermove', map, e));
  }

  function onPointerOver(e) {
    let { target } = e;
    while (target && target !== el) target = target.parentNode;
    if (target !== el) return;

    map.fire(new MapPointerEvent('pointerover', map, e));
  }

  function onPointerOut(e) {
    pointers.up(e);
    map.fire(new MapPointerEvent('pointerout', map, e));
  }

  function onPointerCancel(e) {
    pointers.up(e);
    map.fire(new MapPointerEvent('pointercancel', map, e));
  }

  function onClick(e) {
    if (startPos) {
      const pos = DOM.pointerPos(el, e);
      if (pos.dist(startPos) > options.clickTolerance) {
        return;
      }
    }
    map.fire(new MapPointerEvent('click', map, e));
  }

  function onDblClick(e) {
    const mapEvent = new MapPointerEvent('dblclick', map, e);
    map.fire(mapEvent);

    if (mapEvent.defaultPrevented) {
      return;
    }

    if (pointers.size < 2) {
      map.doubleClickZoom.onDblClick(mapEvent);
    }
  }

  function onContextMenu(e) {
    const rotating = map.dragRotate.isActive();
    if (pointers.size === 0 && !rotating) {
      // Windows: contextmenu fired on mouseup, so fire event now
      map.fire(new MapPointerEvent('contextmenu', map, e));
    } else if (pointers.size > 0) {
      // Mac: contextmenu fired on mousedown; we save it until mouseup for consistency's sake
      contextMenuEvent = e;
    }

    e.preventDefault();
  }

  function onWheel(e) {
    const mapEvent = new MapWheelEvent('wheel', map, e);
    map.fire(mapEvent);

    if (mapEvent.defaultPrevented) {
      return;
    }

    map.scrollZoom.onWheel(e);
  }
};

function makePointerCache() {
  const pointers = new Map();
  let lastEvent;
  return {
    down,
    up,
    get size() {
      return pointers.size;
    },
    get events() {
      return pointers.values();
    },
    get last() {
      return lastEvent;
    }
  };

  function down(e) {
    lastEvent = e;
    pointers.set(e.pointerId, e);
  }

  function up(e) {
    pointers.delete(e.pointerId);
  }
}
