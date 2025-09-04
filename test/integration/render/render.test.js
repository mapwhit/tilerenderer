import harness from '../lib/harness.js';
import renderTest from '../lib/render.js';
import suiteImplementation from '../lib/suite_implementation.js';

const implementation = 'js';
const directory = import.meta.dirname;
harness(directory, implementation, render);

async function render(style, params) {
  const { data } = await suiteImplementation(style, {
    loadRTLTextPlugin: true,
    ...params
  });

  return renderTest(params, { data, directory, implementation });
}
