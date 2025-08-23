import { parseArgs } from 'node:util';
export default getArgs;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'test-bail': {
      type: 'boolean'
    },
    'test-reporter': {
      type: 'string',
      default: process.env.TEST_REPORTER
    },
    shuffle: {
      type: 'boolean',
      default: false
    },
    'recycle-map': {
      type: 'boolean',
      default: false
    },
    seed: {
      type: 'string'
    }
  }
});

function getArgs() {
  return {
    tests: positionals,
    bail: values['test-bail'],
    shuffle: values.shuffle,
    recycleMap: values['recycle-map'],
    seed: values.seed,
    testReporter: values['test-reporter']
  };
}
