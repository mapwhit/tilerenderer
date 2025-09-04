import path from 'node:path';
import ignores from './ignores.json' with { type: 'json' };
import harness from './integration/lib/harness.js';
import renderTest from './integration/lib/render.js';
import suiteImplementation from './suite_implementation.js';
import _window from './util/window.js';

globalThis.window ??= _window;

const options = {
  ignores
};

const implementation = 'js';
const directory = path.resolve(import.meta.dirname, './integration/render/tests');
harness(directory, implementation, options, render);

async function render(style, params) {
  const { data } = await suiteImplementation(style, {
    loadRTLTextPlugin: true,
    ...params
  });

  return renderTest(params, { data, directory, implementation });
}
