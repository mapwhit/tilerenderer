import _window from '../../util/window.js';
import harness from '../lib/harness.js';
import renderTest from '../lib/render.js';
import suiteImplementation from '../lib/suite_implementation.js';

globalThis.window ??= _window;

const options = {};

const implementation = 'js';
const directory = import.meta.dirname;
harness(directory, implementation, options, render);

async function render(style, params) {
  const { data } = await suiteImplementation(style, {
    loadRTLTextPlugin: true,
    ...params
  });

  return renderTest(params, { data, directory, implementation });
}
