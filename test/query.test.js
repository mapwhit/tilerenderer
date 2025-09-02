import path from 'node:path';
import ignores from './ignores.json' with { type: 'json' };
import harness from './integration/lib/harness.js';
import queryTest from './integration/lib/query.js';
import suiteImplementation from './suite_implementation.js';
import getArgs from './util/args.js';
import _window from './util/window.js';

globalThis.window ??= _window;

const options = {
  ignores,
  ...getArgs()
};

const implementation = 'js';

const directory = path.resolve(import.meta.dirname, './integration/query/tests');
harness(directory, implementation, options, runTest);

async function runTest(style, params) {
  const { data, results } = await suiteImplementation(style, params);
  return queryTest(params, { data, results, directory, implementation });
}
