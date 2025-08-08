const test = require('node:test');
const _window = require('../../util/window');
const makeDispatcher = require('../../../src/util/dispatcher');
const makeWorkerPool = require('../../../src/util/worker_pool');

const WebWorker = _window.Worker;

test('Dispatcher', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('requests and releases workers from pool', t => {
    const workers = [new WebWorker(), new WebWorker()];
    const targets = [];
    let removeCalled = 0;

    function Actor(target) {
      targets.push(target);
      return {
        remove: function () {
          removeCalled++;
        }
      };
    }

    const releaseCalled = [];
    const workerPool = {
      acquire: function () {
        return workers;
      },
      release: function (id) {
        releaseCalled.push(id);
      }
    };

    const dispatcher = makeDispatcher(workerPool, {}, Actor);
    t.assert.deepEqual(targets, workers);
    dispatcher.remove();
    t.assert.deepEqual(releaseCalled, [dispatcher.id]);
    t.assert.equal(removeCalled, workers.length);
  });

  await t.test('creates Actors with unique map id', t => {
    const ids = [];
    function Actor(target, parent, mapId) {
      ids.push(mapId);
    }

    const workerPool = makeWorkerPool(1);
    const dispatchers = [makeDispatcher(workerPool, {}, Actor), makeDispatcher(workerPool, {}, Actor)];
    t.assert.deepEqual(
      ids,
      dispatchers.map(d => d.id)
    );
  });

  await t.test('remove destroys actors', t => {
    const actorsRemoved = [];
    function Actor() {
      return {
        remove: function () {
          actorsRemoved.push(this);
        }
      };
    }

    const workerPool = makeWorkerPool(4);
    const dispatcher = makeDispatcher(workerPool, {}, Actor);
    dispatcher.remove();
    t.assert.equal(actorsRemoved.length, 4);
  });
});
