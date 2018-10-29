import test from 'node:test';
import { bezier, clamp, easeCubicInOut, wrap } from '../../../src/util/util.js';

test('util', async t => {
  t.assert.equal(easeCubicInOut(0), 0, 'easeCubicInOut=0');
  t.assert.equal(easeCubicInOut(0.2), 0.03200000000000001);
  t.assert.equal(easeCubicInOut(0.5), 0.5, 'easeCubicInOut=0.5');
  t.assert.equal(easeCubicInOut(1), 1, 'easeCubicInOut=1');

  await t.test('clamp', t => {
    t.assert.equal(clamp(0, 0, 1), 0);
    t.assert.equal(clamp(1, 0, 1), 1);
    t.assert.equal(clamp(200, 0, 180), 180);
    t.assert.equal(clamp(-200, 0, 180), 0);
  });

  await t.test('wrap', t => {
    t.assert.equal(wrap(0, 0, 1), 1);
    t.assert.equal(wrap(1, 0, 1), 1);
    t.assert.equal(wrap(200, 0, 180), 20);
    t.assert.equal(wrap(-200, 0, 180), 160);
  });

  await t.test('bezier', t => {
    const curve = bezier(0, 0, 0.25, 1);
    t.assert.ok(curve instanceof Function, 'returns a function');
    t.assert.equal(curve(0), 0);
    t.assert.equal(curve(1), 1);
    t.assert.equal(curve(0.5), 0.8230854638965502);
  });
});
