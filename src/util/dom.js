const Point = require('@mapbox/point-geometry');

const assert = require('assert');

const DOM = {};
module.exports = DOM;

DOM.create = function (tagName, className, container) {
  const el = window.document.createElement(tagName);
  if (className) el.className = className;
  if (container) container.appendChild(el);
  return el;
};

DOM.createNS = function (namespaceURI, tagName) {
  const el = window.document.createElementNS(namespaceURI, tagName);
  return el;
};

let docStyle;
let selectProp;

DOM.initEnableDisableDrag = function () {
  docStyle = window.document ? window.document.documentElement.style : null;

  function testProp(props) {
    if (!docStyle) return null;
    for (let i = 0; i < props.length; i++) {
      if (props[i] in docStyle) {
        return props[i];
      }
    }
    return props[0];
  }

  selectProp = testProp(['userSelect', 'MozUserSelect', 'WebkitUserSelect', 'msUserSelect']);
};

let userSelect;

DOM.disableDrag = function () {
  if (docStyle && selectProp) {
    userSelect = docStyle[selectProp];
    docStyle[selectProp] = 'none';
  }
};

DOM.enableDrag = function () {
  if (docStyle && selectProp) {
    docStyle[selectProp] = userSelect;
  }
};

// Suppress the next click, but only if it's immediate.
const suppressClick = function (e) {
  e.preventDefault();
  e.stopPropagation();
  window.removeEventListener('click', suppressClick, true);
};

DOM.suppressClick = function () {
  window.addEventListener('click', suppressClick, true);
  window.setTimeout(() => {
    if (typeof window === 'object' && window) {
      window.removeEventListener('click', suppressClick, true);
    }
  }, 0);
};

DOM.mousePos = function (el, e) {
  const rect = el.getBoundingClientRect();
  e = e.touches ? e.touches[0] : e;
  return new Point(e.clientX - rect.left - el.clientLeft, e.clientY - rect.top - el.clientTop);
};

DOM.touchPos = function (el, e) {
  const rect = el.getBoundingClientRect();
  const points = [];
  const touches = e.type === 'touchend' ? e.changedTouches : e.touches;
  for (let i = 0; i < touches.length; i++) {
    points.push(
      new Point(touches[i].clientX - rect.left - el.clientLeft, touches[i].clientY - rect.top - el.clientTop)
    );
  }
  return points;
};

DOM.mouseButton = function (e) {
  assert(e.type === 'mousedown' || e.type === 'mouseup');
  if (
    typeof window.InstallTrigger !== 'undefined' &&
    e.button === 2 &&
    e.ctrlKey &&
    window.navigator.platform.toUpperCase().indexOf('MAC') >= 0
  ) {
    // Fix for https://github.com/mapbox/mapbox-gl-js/issues/3131:
    // Firefox (detected by InstallTrigger) on Mac determines e.button = 2 when
    // using Control + left click
    return 0;
  }
  return e.button;
};
