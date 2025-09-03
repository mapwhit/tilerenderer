import path from 'node:path';
import ignores from './ignores.json' with { type: 'json' };
import harness from './integration/lib/harness.js';
import renderTest from './integration/lib/render.js';
import suiteImplementation from './suite_implementation.js';
import getArgs from './util/args.js';
import _window from './util/window.js';

globalThis.window ??= _window;

const options = {
  ignores,
  ...getArgs()
};

options.seed ??= makeHash();

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

// https://stackoverflow.com/a/1349426/229714
function makeHash() {
  const array = [];
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < 10; ++i) {
    array.push(possible.charAt(Math.floor(Math.random() * possible.length)));
  }

  // join array elements without commas.
  return array.join('');
}
