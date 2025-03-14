const { test } = require('../../util/mapbox-gl-js-test');
const _window = require('../../util/window');
const Actor = require('../../../src/util/actor');

const WebWorker = _window.Worker;

test('Actor', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('forwards responses to correct callback with promises', async t => {
    t.stub(WebWorker, 'Worker').callsFake(function Worker(self) {
      this.self = self;
      this.actor = new Actor(self, this);
      this.test = function (mapId, params) {
        return Promise.resolve(params);
      };
    });

    const worker = new WebWorker();

    const m1 = new Actor(worker, {}, 'map-1');
    const m2 = new Actor(worker, {}, 'map-2');

    const responses = await Promise.all([m1.send('test', { value: 1729 }), m2.send('test', { value: 4104 })]);

    t.assert.deepEqual(responses[0], { value: 1729 });
    t.assert.deepEqual(responses[1], { value: 4104 });
  });

  await t.test('targets worker-initiated messages to correct map instance', async t => {
    let workerActor;

    t.stub(WebWorker, 'Worker').callsFake(function Worker(self) {
      this.self = self;
      this.actor = workerActor = new Actor(self, this);
    });

    const worker = new WebWorker();
    let calls = 0;

    new Actor(
      worker,
      {
        test() {
          calls++;
        }
      },
      'map-1'
    );
    new Actor(
      worker,
      {
        test() {
          t.assert.fail();
        }
      },
      'map-2'
    );

    await workerActor.send('test', {}, 'map-1');
    t.assert.equal(calls, 1);
  });

  await t.test('#remove unbinds event listener', (t, done) => {
    const actor = new Actor(
      {
        addEventListener: function (type, callback, useCapture) {
          this._addEventListenerArgs = [type, callback, useCapture];
        },
        removeEventListener: function (type, callback, useCapture) {
          t.assert.deepEqual([type, callback, useCapture], this._addEventListenerArgs, 'listener removed');
          done();
        }
      },
      {},
      null
    );
    actor.remove();
  });
});
