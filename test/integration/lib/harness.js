import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import makeLoader from './loader.js';

const loader = makeLoader();

export default async function harness(cwd, implementation, runTest) {
  const files = glob('**/style.json', { cwd });
  // iterate over files
  for await (const file of files) {
    const id = path.dirname(file);
    const skip = implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && test.id.match(/^debug\//);

    test(id, { skip, concurrency: true }, async t => {
      const styleData = await readFile(path.join(cwd, file), 'utf8');
      const style = JSON.parse(styleData);
      fixtureToStyle(style, id, implementation);
      const st = style.metadata.test;
      try {
        await loader.localizeURLs(style);
        await runTest(style, st);
        t.assert.ok(st.ok, `${st.id} failed:\n${st.difference}`);
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
