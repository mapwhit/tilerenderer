import harness from '../harness.js';
import suiteImplementation from '../suite_implementation.js';
import validate from './validate.js';

const implementation = 'js';

export default function run(directory) {
  harness(directory, implementation, runTest);

  async function runTest(style, params) {
    const { data, results } = await suiteImplementation(style, params);
    return validate(params, { data, results, directory, implementation });
  }
}
