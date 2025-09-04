import harness from '../harness.js';
import suiteImplementation from '../suite_implementation.js';
import validate from './validate.js';

const implementation = 'js';

export default function run(directory) {
  harness(directory, implementation, render);

  async function render(style, params) {
    const { data } = await suiteImplementation(style, {
      loadRTLTextPlugin: true,
      ...params
    });

    return validate(params, { data, directory, implementation });
  }
}
