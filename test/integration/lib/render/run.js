import harness from '../harness.js';
import suiteImplementation from '../suite_implementation.js';
import validate from './validate.js';

export default function run(directory, { prefix, implementation = 'js' } = {}) {
  harness(directory, runTest, { implementation, prefix });

  async function runTest(style, params) {
    const { data } = await suiteImplementation(style, {
      loadRTLTextPlugin: true,
      ...params
    });

    return validate(params, { data, directory, implementation });
  }
}
