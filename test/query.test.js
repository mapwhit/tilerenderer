import ignores from './ignores.json' with { type: 'json' };
import { query } from './integration/index.js';
import suiteImplementation from './suite_implementation.js';
import getArgs from './util/args.js';
import _window from './util/window.js';

globalThis.window ??= _window;

const options = {
  ignores,
  ...getArgs()
};

query('js', options, suiteImplementation);
