import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';
import Map from '../src/ui/map.js';
import browser from '../src/util/browser.js';
import config from '../src/util/config.js';
import { readPNG } from './integration/lib/png.js';

const rtlText = import.meta.resolve('./node_modules/@mapbox/mapbox-gl-rtl-text/mapbox-gl-rtl-text.js');

async function loadPlugin() {
  const { clearRTLTextPlugin, registerForPluginAvailability, setRTLTextPlugin } = await import(
    '../src/source/rtl_text_plugin.js'
  );
  clearRTLTextPlugin();
  setRTLTextPlugin(rtlText);
  await promisify(registerForPluginAvailability)();
}

let pluginloaded;

export default async function suiteImplementation(style, options) {
  pluginloaded ??= loadPlugin();
  await pluginloaded;

  window.devicePixelRatio = options.pixelRatio;

  const container = window.document.createElement('div');
  Object.defineProperty(container, 'offsetWidth', { value: options.width });
  Object.defineProperty(container, 'offsetHeight', { value: options.height });

  // We are self-hosting test files.
  config.REQUIRE_ACCESS_TOKEN = false;

  const map = new Map({
    container,
    style,
    classes: options.classes,
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: true,
    axonometric: options.axonometric ?? false,
    skew: options.skew ?? [0, 0],
    fadeDuration: options.fadeDuration ?? 0,
    crossSourceCollisions: options.crossSourceCollisions ?? true
  });

  // Configure the map to never stop the render loop
  map.repaint = true;

  let now = 0;
  browser.now = function () {
    return now;
  };

  if (options.debug) {
    map.showTileBoundaries = true;
  }
  if (options.showOverdrawInspector) {
    map.showOverdrawInspector = true;
  }

  const gl = map.painter.context.gl;

  await map.once('load');
  if (options.collisionDebug) {
    map.showCollisionBoxes = true;
    if (options.operations) {
      options.operations.push(['wait']);
    } else {
      options.operations = [['wait']];
    }
  }
  await applyOperations(map, options.operations);
  const viewport = gl.getParameter(gl.VIEWPORT);
  const w = viewport[2];
  const h = viewport[3];

  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const data = Buffer.from(pixels);

  // Flip the scanlines.
  const stride = w * 4;
  const tmp = Buffer.alloc(stride);
  for (let i = 0, j = h - 1; i < j; i++, j--) {
    const start = i * stride;
    const end = j * stride;
    data.copy(tmp, 0, start, start + stride);
    data.copy(data, start, end, end + stride);
    tmp.copy(data, end);
  }

  const results = options.queryGeometry
    ? map.queryRenderedFeatures(options.queryGeometry, options.queryOptions ?? {}).map(feature => {
        const f = feature.toJSON();
        delete f.layer;
        return f;
      })
    : [];

  map.remove();
  gl.getExtension('STACKGL_destroy_context').destroy();
  delete map.painter.context.gl;

  return {
    data,
    results
  };

  async function applyOperations(map, operations = []) {
    for (const [operation, ...args] of operations) {
      switch (operation) {
        case 'wait':
          if (args.length > 0) {
            now += args[0];
            map._render();
          } else {
            while (!loaded(map)) {
              await map.once('render');
            }
          }
          break;
        case 'sleep':
          // Prefer "wait", which renders until the map is loaded
          // Use "sleep" when you need to test something that sidesteps the "loaded" logic
          await setTimeout(args[0]);
          break;
        case 'addImage': {
          const [image, filename, opts = {}] = args;
          const { data, width, height } = await readPNG(path.join(import.meta.dirname, './integration', filename));
          map.addImage(image, { width, height, data: new Uint8Array(data) }, opts);
          break;
        }
        default:
          map[operation].apply(map, args);
      }
    }
  }

  // the difference between this function and `Map.loaded()` is that
  // we don't check `_styleDirty` as it is always false when `render`
  // event fires but can change right after - if we use `Map.loaded()`
  // then we cannot wait for event `render` asynchronously
  function loaded(map) {
    if (map._sourcesDirty) {
      return false;
    }
    if (!map.style || !map.style.loaded()) {
      return false;
    }
    return true;
  }
}
