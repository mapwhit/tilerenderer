const { test } = require('../../util/mapbox-gl-js-test');
const taskQueue = require('../../../src/util/task_queue');

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
    const fn = t.spy();
    q.add(fn);
    q.add(fn);
    q.run();
    t.assert.equal(fn.callCount, 2);
  });

  await t.test('Does not call a callback that was cancelled before the queue was run', t => {
    const q = taskQueue();
    const yes = t.spy();
    const no = t.spy();
    q.add(yes);
    const id = q.add(no);
    q.remove(id);
    q.run();
    t.assert.equal(yes.callCount, 1);
    t.assert.equal(no.callCount, 0);
  });

  await t.test('Does not call a callback that was cancelled while the queue was running', t => {
    const q = taskQueue();
    const yes = t.spy();
    const no = t.spy();
    q.add(yes);
    const data = {};
    q.add(() => q.remove(data.id));
    data.id = q.add(no);
    q.run();
    t.assert.equal(yes.callCount, 1);
    t.assert.equal(no.callCount, 0);
  });

  await t.test('Allows each instance of a multiply-queued callback to be cancelled independently', t => {
    const q = taskQueue();
    const cb = t.spy();
    q.add(cb);
    const id = q.add(cb);
    q.remove(id);
    q.run();
    t.assert.equal(cb.callCount, 1);
  });

  await t.test('Does not throw if a remove() is called after running the queue', t => {
    const q = taskQueue();
    const cb = t.spy();
    const id = q.add(cb);
    q.run();
    q.remove(id);
    t.assert.equal(cb.callCount, 1);
  });

  await t.test('Does not add tasks to the currently-running queue', t => {
    const q = taskQueue();
    const cb = t.spy();
    q.add(() => q.add(cb));
    q.run();
    t.assert.equal(cb.callCount, 0);
    q.run();
    t.assert.equal(cb.callCount, 1);
  });

  await t.test('TaskQueue#run() throws on attempted re-entrance', t => {
    const q = taskQueue();
    q.add(() => q.run());
    t.assert.throws(() => q.run());
  });

  await t.test('TaskQueue#clear() prevents queued task from being executed', t => {
    const q = taskQueue();
    const before = t.spy();
    const after = t.spy();
    q.add(before);
    q.clear();
    q.add(after);
    q.run();
    t.assert.equal(before.callCount, 0);
    t.assert.equal(after.callCount, 1);
  });

  await t.test('TaskQueue#clear() interrupts currently-running queue', t => {
    const q = taskQueue();
    const before = t.spy();
    const after = t.spy();
    q.add(() => q.add(after));
    q.add(() => q.clear());
    q.add(before);
    q.run();
    t.assert.equal(before.callCount, 0);
    q.run();
    t.assert.equal(after.callCount, 0);
  });
});
