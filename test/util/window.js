import canvas from 'canvas';
import gl from 'gl';
import jsdom from 'jsdom';
import '../../src/source/rtl_text_plugin.js';

const _window = create();

export default _window;

function create() {
  // Create new window and inject into exported object
  const { window } = new jsdom.JSDOM('', {
    url: 'https://example.org/',
    // Send jsdom console output to the node console object.
    virtualConsole: new jsdom.VirtualConsole().sendTo(console),
    // load images
    resources: 'usable',
    runScripts: 'dangerously' // allow scripts to run - needed for RTL plugin loading
  });

  window.devicePixelRatio = 1;

  window.requestAnimationFrame = function (callback) {
    return setImmediate(callback, 0);
  };
  window.cancelAnimationFrame = clearImmediate;

  // Add webgl context with the supplied GL
  const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
  window.HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    if (type === 'webgl') {
      if (!this._webGLContext) {
        this._webGLContext = gl(this.width, this.height, attributes);
      }
      return this._webGLContext;
    }
    // Fallback to existing HTMLCanvasElement getContext behaviour
    return originalGetContext.call(this, type, attributes);
  };

  window.Blob = Blob;
  window.URL.createObjectURL ??= obj => (obj?.type === 'image/png' ? createPngUrl(obj) : URL.createObjectURL(obj));
  window.URL.revokeObjectURL ??= URL.revokeObjectURL;

  globalThis.ImageData ??=
    canvas.ImageData ??
    function () {
      return false;
    };
  globalThis.HTMLImageElement ??= window.HTMLImageElement;
  globalThis.HTMLImageElement.prototype.decode ??= function () {
    return new Promise(resolve => {
      this.addEventListener('load', resolve);
    });
  };
  globalThis.HTMLCanvasElement ??= window.HTMLCanvasElement;
  globalThis.HTMLVideoElement ??= window.HTMLVideoElement;
  window.ImageBitmap ??= function () {
    return false;
  };
  window.WebGLFramebuffer ??= Object;

  globalThis.document ??= window.document;

  return window;
}

async function createPngUrl(obj) {
  const png = await obj.bytes();
  const pngUrl = `data:${obj.type};base64,${Buffer.from(png).toString('base64')}`;
  return pngUrl;
}
