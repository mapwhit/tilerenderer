globalThis.window ??= require('./util/window');

const { render: suite } = require('./integration');
const suiteImplementation = require('./suite_implementation');
const ignores = require('./ignores.json');

const options = {
  ignores,
  tests: [],
  shuffle: false,
  recycleMap: false,
  testReporter: process.env.TEST_REPORTER
};

suite.run('js', options, suiteImplementation);
