import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import makeLoader from './loader.js';

const loader = makeLoader();

/**
 * Runs integration tests by iterating through style.json files in a given directory,
 * parsing them, and executing a provided test function for each.
 *
 * @param {string} cwd - The current working directory to search for `style.json` files.
 * @param {function(object, object): Promise<void>} runTest - The test function to execute for each style.
 *   It receives the parsed style object and the test metadata.
 * @param {object} options - Options for the harness.
 * @param {string} [options.implementation] - 'js' or 'native'
 * @param {string|boolean} [options.prefix] - A prefix to add to the test IDs. If `true`, the basename of `cwd` is used as the prefix.
 * @returns {Promise<void>} A promise that resolves when all tests have been run.
 */
export default async function harness(cwd, runTest, { implementation, prefix }) {
  const files = glob('**/style.json', { cwd });
  if (prefix === true) {
    prefix = path.basename(cwd);
  }
  // iterate over files
  for await (const file of files) {
    const id = path.dirname(file);
    const testId = prefix ? `${prefix}/${id}` : id;
    const skip = implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && test.id.match(/^debug\//);

    test(testId, { skip, concurrency: true }, async t => {
      const styleData = await readFile(path.join(cwd, file), 'utf8');
      const style = JSON.parse(styleData);
      fixtureToStyle(style, id, implementation);
      const st = style.metadata.test;
      try {
        await loader.localizeURLs(style);
        await runTest(style, st);
        t.assert.ok(st.ok, `${testId} failed:\n${st.difference}`);
      } catch (error) {
        st.error = error;
        throw error;
      }
    });
  }
}

function fixtureToStyle(style, id, implementation) {
  style.metadata ??= {};
  style.metadata.test = Object.assign(
    {
      id,
      width: 512,
      height: 512,
      pixelRatio: 1,
      recycleMap: false,
      allowed: 0.00015
    },
    style.metadata.test
  );
  const { test } = style.metadata;

  if ('diff' in test) {
    if (typeof test.diff === 'number') {
      test.allowed = test.diff;
    } else if (implementation in test.diff) {
      test.allowed = test.diff[implementation];
    }
  }

  return style;
}
