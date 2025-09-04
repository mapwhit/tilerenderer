import { createWriteStream } from 'node:fs';
import { glob, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import template from 'lodash.template';
import makeLoader from './loader.js';

export default async function harness(cwd, implementation, runTest) {
  const files = glob('**/style.json', { cwd });
  const tests = [];
  // iterate over files
  for await (const file of files) {
    const id = path.dirname(file);
    const styleData = await readFile(path.join(cwd, file), 'utf8');
    const style = JSON.parse(styleData);

    fixtureToStyle(style, id, implementation);
    const st = style.metadata.test;
    await test(id, { skip: st.skip }, async t => {
      await loader.localizeURLs(style);

      try {
        await runTest(style, st);
        t.assert.ok(st.ok, `${st.id} failed:\n${st.difference}`);
      } catch (error) {
        st.error = error;
        throw error;
      }
    });
    tests.push(st);
  }

  if (process.env.UPDATE) {
    console.log(`Updated ${tests.length} tests.`);
    process.exit(0);
  }

  await writeResults(cwd, tests);
}

const loader = makeLoader();

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

  if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && test.id.match(/^debug\//)) {
    test.skip = true;
  }

  return style;
}

async function writeResults(cwd, tests) {
  const p = path.join(cwd, 'index.html');
  await pipeline(resuts(), createWriteStream(p));

  console.log(`Results at: ${p}`);

  async function* resuts() {
    const resultsTemplate = await loadTemplate(import.meta.dirname, '..', 'results.html.tmpl');
    const itemTemplate = await loadTemplate(cwd, 'tests', 'result_item.html.tmpl');
    const unsuccessful = tests.filter(test => test.status === 'failed' || test.status === 'errored');
    const hasFailedTests = unsuccessful.length > 0;
    const [header, footer] = resultsTemplate({
      unsuccessful,
      tests,
      shuffle: false,
      seed: false
    }).split('<!-- results go here -->');
    yield header;
    for (const r of tests) {
      yield itemTemplate({ r, hasFailedTests });
    }
    yield footer;
  }
}

async function loadTemplate(...paths) {
  const filename = path.resolve(...paths);
  const content = await readFile(filename, 'utf8');
  return template(content);
}
