import _window from '../../util/window.js';
import harness from '../lib/harness.js';
import queryTest from '../lib/query.js';
import suiteImplementation from '../lib/suite_implementation.js';

globalThis.window ??= _window;

const implementation = 'js';

const directory = import.meta.dirname;
harness(directory, implementation, runTest);

async function runTest(style, params) {
  const { data, results } = await suiteImplementation(style, params);
  return queryTest(params, { data, results, directory, implementation });
}
