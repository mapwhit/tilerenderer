const test = require('node:test');
const _window = require('../../util/window');
const makeWorkerPool = require('../../../src/util/worker_pool');

test('WorkerPool', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('#acquire', t => {
    const pool = makeWorkerPool(4);

    t.assert.ok(!pool.workers);
    const workers1 = pool.acquire('map-1');
    const workers2 = pool.acquire('map-2');
    t.assert.equal(workers1.length, 4);
    t.assert.equal(workers2.length, 4);

    // check that the two different dispatchers' workers arrays correspond
    workers1.forEach((w, i) => t.assert.equal(w, workers2[i]));
  });

  await t.test('#release', t => {
    let workersTerminated = 0;

    const pool = makeWorkerPool(4);
    pool.acquire('map-1');
    const workers = pool.acquire('map-2');
    workers.forEach(w => {
      w.terminate = function () {
        workersTerminated += 1;
      };
    });

    pool.release('map-2');
    t.assert.equal(workersTerminated, 0, 'keeps workers if a dispatcher is still active');

    pool.release('map-1');
    t.assert.equal(workersTerminated, 4, 'terminates workers if no dispatchers are active');
  });
});
