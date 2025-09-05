import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import template from 'lodash.template';

export async function writeResults(cwd, tests) {
  const p = path.join(cwd, 'index.html');
  await pipeline(resuts(), createWriteStream(p));

  console.log(`Results at: ${p}`);

  async function* resuts() {
    const resultsTemplate = await loadTemplate(import.meta.dirname, '..', 'results.html.tmpl');
    const itemTemplate = await loadTemplate(cwd, '..', 'result_item.html.tmpl');
    const unsuccessful = tests.filter(test => test.status === 'failed' || test.status === 'errored');
    const hasFailedTests = unsuccessful.length > 0;
    const [header, footer] = resultsTemplate({
      unsuccessful,
      tests
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
