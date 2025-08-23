import test from 'node:test';
import { config, version } from '../../src/index.js';

test('mapboxgl', async t => {
  await t.test('version', t => {
    t.assert.ok(version);
  });

  await t.test('workerCount', t => {
    t.assert.ok(typeof config.workerCount === 'number');
  });
});
