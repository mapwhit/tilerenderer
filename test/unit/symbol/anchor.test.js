import test from 'node:test';
import Anchor from '../../../src/symbol/anchor.js';

test('Anchor', async t => {
  await t.test('constructor', t => {
    t.assert.ok(new Anchor(0, 0, 0, []) instanceof Anchor, 'creates an object');
    t.assert.ok(new Anchor(0, 0, 0, [], []) instanceof Anchor, 'creates an object with a segment');
  });
  await t.test('clone', t => {
    const a = new Anchor(1, 2, 3, []);
    const b = new Anchor(1, 2, 3, []);
    t.assert.deepEqual(a.clone(), b);
    t.assert.deepEqual(a.clone(), a);
  });
});
