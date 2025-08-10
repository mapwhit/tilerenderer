globalThis.window ??= require('./util/window');

const { query: querySuite } = require('./integration');
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

let tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
  tests = process.argv.slice(2);
}

querySuite.run('js', { tests, ignores, testReporter: process.env.TEST_REPORTER }, suiteImplementation);
