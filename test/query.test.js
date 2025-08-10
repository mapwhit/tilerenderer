globalThis.window ??= require('./util/window');

const { query } = require('./integration');
const suiteImplementation = require('./suite_implementation');
const getArgs = require('./util/args');
const ignores = require('./ignores.json');

const options = {
  ignores,
  ...getArgs()
};

query.run('js', options, suiteImplementation);
