import test from 'node:test';
import throttle from '../../../src/util/throttle.js';

test('throttle', async t => {
  await t.test('does not execute unthrottled function unless throttled function is invoked', t => {
    let executionCount = 0;
    throttle(() => {
      executionCount++;
    }, 0);
    t.assert.equal(executionCount, 0);
  });

  await t.test('executes unthrottled function once per tick when period is 0', (t, done) => {
    let executionCount = 0;
    const throttledFunction = throttle(() => {
      executionCount++;
    }, 0);
    throttledFunction();
    throttledFunction();
    t.assert.equal(executionCount, 1);
    setTimeout(() => {
      throttledFunction();
      throttledFunction();
      t.assert.equal(executionCount, 2);
      done();
    }, 0);
  });

  await t.test('executes unthrottled function immediately once when period is > 0', t => {
    let executionCount = 0;
    const throttledFunction = throttle(() => {
      executionCount++;
    }, 5);
    throttledFunction();
    throttledFunction();
    throttledFunction();
    t.assert.equal(executionCount, 1);
  });

  await t.test('queues exactly one execution of unthrottled function when period is > 0', (t, done) => {
    let executionCount = 0;
    const throttledFunction = throttle(() => {
      executionCount++;
    }, 5);
    throttledFunction();
    throttledFunction();
    throttledFunction();
    setTimeout(() => {
      t.assert.equal(executionCount, 2);
      done();
    }, 10);
  });
});
