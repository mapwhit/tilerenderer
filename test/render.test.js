globalThis.window ??= require('./util/window');

const { render: suite } = require('./integration');
const suiteImplementation = require('./suite_implementation');
const getArgs = require('./util/args');
const ignores = require('./ignores.json');

const options = {
  ignores,
  ...getArgs()
};

suite.run('js', options, suiteImplementation);
