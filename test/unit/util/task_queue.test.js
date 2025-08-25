import test from 'node:test';
import taskQueue from '../../../src/util/task_queue.js';

test('TaskQueue', async t => {
  await t.test('Calls callbacks, in order', t => {
    const q = taskQueue();
    let result = '';
    q.add(() => (result += 'a'));
    q.add(() => (result += 'b'));
    q.run();
    t.assert.equal(result, 'ab');
  });

  await t.test('Allows a given callback to be queued multiple times', t => {
    const q = taskQueue();
    const fn = t.mock.fn();
    q.add(fn);
    q.add(fn);
    q.run();
    t.assert.equal(fn.mock.callCount(), 2);
  });

  await t.test('Does not call a callback that was cancelled before the queue was run', t => {
    const q = taskQueue();
    const yes = t.mock.fn();
    const no = t.mock.fn();
    q.add(yes);
    const id = q.add(no);
    q.remove(id);
    q.run();
    t.assert.equal(yes.mock.callCount(), 1);
    t.assert.equal(no.mock.callCount(), 0);
  });

  await t.test('Does not call a callback that was cancelled while the queue was running', t => {
    const q = taskQueue();
    const yes = t.mock.fn();
    const no = t.mock.fn();
    q.add(yes);
    const data = {};
    q.add(() => q.remove(data.id));
    data.id = q.add(no);
    q.run();
    t.assert.equal(yes.mock.callCount(), 1);
    t.assert.equal(no.mock.callCount(), 0);
  });

  await t.test('Allows each instance of a multiply-queued callback to be cancelled independently', t => {
    const q = taskQueue();
    const cb = t.mock.fn();
    q.add(cb);
    const id = q.add(cb);
    q.remove(id);
    q.run();
    t.assert.equal(cb.mock.callCount(), 1);
  });

  await t.test('Does not throw if a remove() is called after running the queue', t => {
    const q = taskQueue();
    const cb = t.mock.fn();
    const id = q.add(cb);
    q.run();
    q.remove(id);
    t.assert.equal(cb.mock.callCount(), 1);
  });

  await t.test('Does not add tasks to the currently-running queue', t => {
    const q = taskQueue();
    const cb = t.mock.fn();
    q.add(() => q.add(cb));
    q.run();
    t.assert.equal(cb.mock.callCount(), 0);
    q.run();
    t.assert.equal(cb.mock.callCount(), 1);
  });

  await t.test('TaskQueue.run() throws on attempted re-entrance', t => {
    const q = taskQueue();
    q.add(() => q.run());
    t.assert.throws(() => q.run());
  });

  await t.test('TaskQueue.clear() prevents queued task from being executed', t => {
    const q = taskQueue();
    const before = t.mock.fn();
    const after = t.mock.fn();
    q.add(before);
    q.clear();
    q.add(after);
    q.run();
    t.assert.equal(before.mock.callCount(), 0);
    t.assert.equal(after.mock.callCount(), 1);
  });

  await t.test('TaskQueue.clear() interrupts currently-running queue', t => {
    const q = taskQueue();
    const before = t.mock.fn();
    const after = t.mock.fn();
    q.add(() => q.add(after));
    q.add(() => q.clear());
    q.add(before);
    q.run();
    t.assert.equal(before.mock.callCount(), 0);
    q.run();
    t.assert.equal(after.mock.callCount(), 0);
  });
});
