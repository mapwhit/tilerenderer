import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import template from 'lodash.template';
import makeLoader from './loader.js';

export default async function harness(cwd, implementation, options, run) {
  const sequence = await generateTestSequence(cwd, implementation, options);
  const tests = await runSequence(sequence, run);

  if (process.env.UPDATE) {
    console.log(`Updated ${tests.length} tests.`);
    process.exit(0);
  }

  await writeResults(cwd, tests);
}

function runSequence(sequence, runTest) {
  const tasks = sequence.map(async style => {
    const st = style.metadata.test;
    await test(st.id, { skip: st.skip }, async t => {
      try {
        await runTest(style, st);
        t.assert.ok(st.ok, `${st.id} failed:\n${st.difference}`);
      } catch (error) {
        st.error = error;
        throw error;
      }
    });
    return st;
  });
  return Promise.all(tasks);
}

async function generateTestSequence(cwd, implementation, { ignores = {} }) {
  const loader = makeLoader();

  const files = fs.glob('**/style.json', { cwd });
  let sequence = await Promise.all(await Array.fromAsync(files, fixtureToStyle));
  sequence = sequence.filter(Boolean);

  return sequence;

  async function fixtureToStyle(fixture) {
    const id = path.dirname(fixture);
    const styleData = await fs.readFile(path.join(cwd, fixture), 'utf8');
    const style = JSON.parse(styleData);

    await loader.localizeURLs(style);

    style.metadata ??= {};
    const test = (style.metadata.test = Object.assign(
      {
        id,
        ignored: ignores[`${path.basename(cwd)}/${id}`],
        width: 512,
        height: 512,
        pixelRatio: 1,
        recycleMap: false,
        allowed: 0.00015
      },
      style.metadata.test
    ));

    if ('diff' in test) {
      if (typeof test.diff === 'number') {
        test.allowed = test.diff;
      } else if (implementation in test.diff) {
        test.allowed = test.diff[implementation];
      }
    }

    markSkipped(style);
    return style;
  }

  function markSkipped(style) {
    const { test } = style.metadata;
    const { id, ignored } = test;

    if (implementation === 'native' && process.env.BUILDTYPE !== 'Debug' && id.match(/^debug\//)) {
      test.skip = true;
      return false;
    }

    if (/^skip/.test(ignored)) {
      test.skip = true;
      return false;
    }

    return true;
  }
}

async function writeResults(cwd, tests) {
  const p = path.join(cwd, 'index.html');
  await pipeline(resuts(), createWriteStream(p));

  console.log(`Results at: ${p}`);

  async function* resuts() {
    const resultsTemplate = template(
      await fs.readFile(path.join(import.meta.dirname, '..', 'results.html.tmpl'), 'utf8')
    );
    const itemTemplate = template(await fs.readFile(path.join(cwd, 'result_item.html.tmpl'), 'utf8'));
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
