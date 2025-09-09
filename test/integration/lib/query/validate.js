import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export default async function queryTest(params, { results, directory }) {
  const dir = path.join(directory, params.id);

  if (process.env.UPDATE) {
    await writeFile(path.join(dir, 'expected.json'), JSON.stringify(stripPrecision(results), null, 2));
    return;
  }

  const expectedData = await readFile(path.join(dir, 'expected.json'), 'utf8');
  const expected = JSON.parse(expectedData);

  assert.deepEqual(stripPrecision(results), expected);
}

const digits = 11;
const multiplier = 10 ** digits;

/**
 * Strips a number down to a specified number of decimal significant figures,
 * or recursively processes arrays and objects. This is used to normalize
 * floating-point output for comparisons in tests.
 *
 * @param {number|object|Array<any>|null} x - The value to strip precision from.
 * @returns {number|object|Array<any>|null} The value with precision stripped.
 */
function stripPrecision(x) {
  if (typeof x === 'number') {
    if (x === 0) {
      return x;
    }
    // We strip precision twice in a row here to avoid cases where
    // stripping an already stripped number will modify its value
    // due to bad floating point precision luck
    // eg `Math.floor(8.16598 * 100000) / 100000` -> 8.16597
    const firstStrip = Math.floor(x * multiplier) / multiplier;
    return Math.floor(firstStrip * multiplier) / multiplier;
  }
  if (x == null || typeof x !== 'object') {
    return x;
  }
  return Array.isArray(x)
    ? x.map(stripPrecision)
    : Object.fromEntries(Object.entries(x).map(p => [p[0], stripPrecision(p[1])]));
}
