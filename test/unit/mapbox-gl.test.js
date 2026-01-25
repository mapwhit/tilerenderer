import test from 'node:test';
import { version } from '../../src/index.js';

test('mapboxgl', async t => {
  await t.test('version', t => {
    t.assert.ok(version);
  });
});
