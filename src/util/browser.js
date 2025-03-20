// TODO move code that assumes that `window` may not be set to relevant tests

const now =
  typeof window === 'object' && window.performance?.now
    ? window.performance.now.bind(window.performance)
    : Date.now.bind(Date);

const raf =
  typeof window === 'object'
    ? window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.msRequestAnimationFrame
    : fn => setTimeout(fn, 0);

const cancel =
  typeof window === 'object'
    ? window.cancelAnimationFrame ||
      window.mozCancelAnimationFrame ||
      window.webkitCancelAnimationFrame ||
      window.msCancelAnimationFrame
    : id => clearTimeout(id);

/**
 * @private
 */
const exported = {
  /**
   * Provides a function that outputs milliseconds: either performance.now()
   * or a fallback to Date.now()
   */
  now,

  frame(fn) {
    return raf(fn);
  },

  cancelFrame(id) {
    return cancel(id);
  },

  getImageData(img) {
    const canvas = window.document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('failed to create canvas 2d context');
    }
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0, img.width, img.height);
    return context.getImageData(0, 0, img.width, img.height);
  },

  resolveURL(path) {
    const a = window.document.createElement('a');
    a.href = path;
    return a.href;
  },

  hardwareConcurrency: typeof window === 'object' ? window.navigator.hardwareConcurrency : 4,

  get devicePixelRatio() {
    return typeof window === 'object' ? window.devicePixelRatio : 1;
  }
};

module.exports = exported;
