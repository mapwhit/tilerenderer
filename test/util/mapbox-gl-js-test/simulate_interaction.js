function window(target) {
  if (target.ownerDocument) {
    return target.ownerDocument.defaultView;
  }
  if (target.defaultView) {
    return target.defaultView;
  }
  return target;
}

exports.click = function (target, options) {
  options = { bubbles: true, pointerType: 'mouse', ...options };
  const { MouseEvent } = window(target);
  target.dispatchEvent(new MouseEvent('pointerdown', options));
  target.dispatchEvent(new MouseEvent('pointerup', options));
  target.dispatchEvent(new MouseEvent('click', options));
};

exports.drag = function (target, mousedownOptions, mouseUpOptions) {
  mousedownOptions = { bubbles: true, pointerType: 'mouse', ...mousedownOptions };
  mouseUpOptions = { bubbles: true, pointerType: 'mouse', ...mouseUpOptions };
  const { MouseEvent } = window(target);
  target.dispatchEvent(new MouseEvent('pointerdown', mousedownOptions));
  target.dispatchEvent(new MouseEvent('pointerup', mouseUpOptions));
  target.dispatchEvent(new MouseEvent('click', mouseUpOptions));
};

exports.dblclick = function (target, options) {
  options = { bubbles: true, pointerType: 'mouse', ...options };
  const { MouseEvent } = window(target);
  target.dispatchEvent(new MouseEvent('pointerdown', options));
  target.dispatchEvent(new MouseEvent('pointerup', options));
  target.dispatchEvent(new MouseEvent('click', options));
  target.dispatchEvent(new MouseEvent('pointerdown', options));
  target.dispatchEvent(new MouseEvent('pointerup', options));
  target.dispatchEvent(new MouseEvent('click', options));
  target.dispatchEvent(new MouseEvent('dblclick', options));
};

['pointerup', 'pointerdown', 'pointerover', 'pointermove', 'pointerout', 'pointercancel'].forEach(event => {
  exports[event] = function (target, options) {
    options = {
      bubbles: true,
      pointerType: 'mouse',
      ...options
    };
    const { MouseEvent } = window(target);
    target.dispatchEvent(new MouseEvent(event, options));
  };
});

['wheel', 'mousewheel'].forEach(event => {
  exports[event] = function (target, options) {
    options = Object.assign({ bubbles: true }, options);
    const WheelEvent = window(target).WheelEvent;
    target.dispatchEvent(new WheelEvent(event, options));
  };
});

// magic deltaY value that indicates the event is from a mouse wheel
// (rather than a trackpad)
exports.magicWheelZoomDelta = 4.000244140625;

// ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(event => {
//   exports[event] = function (target, options) {
//     // Should be using Touch constructor here, but https://github.com/jsdom/jsdom/issues/2152.
//     options = Object.assign({ bubbles: true, touches: [{ clientX: 0, clientY: 0 }] }, options);
//     const TouchEvent = window(target).TouchEvent;
//     target.dispatchEvent(new TouchEvent(event, options));
//   };
// });

['focus', 'blur'].forEach(event => {
  exports[event] = function (target, options) {
    options = Object.assign({ bubbles: true }, options);
    const FocusEvent = window(target).FocusEvent;
    target.dispatchEvent(new FocusEvent(event, options));
  };
});
