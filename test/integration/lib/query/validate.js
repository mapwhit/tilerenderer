import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export default async function queryTest(params, { results, directory }) {
  const dir = path.join(directory, params.id);

  if (process.env.UPDATE) {
    await writeFile(path.join(dir, 'expected.json'), JSON.stringify(results, null, 2));
    return;
  }

  const expectedData = await readFile(path.join(dir, 'expected.json'), 'utf8');
  const expected = JSON.parse(expectedData);

  assert.deepEqual(results, expected);
}
