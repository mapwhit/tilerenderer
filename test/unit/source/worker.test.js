const test = require('node:test');
const Worker = require('../../../src/source/worker');

const _self = {
  addEventListener: function () {}
};

test('load tile', async t => {
  await t.test('calls callback on error', async t => {
    const worker = new Worker(_self);
    await t.assert.rejects(
      worker.loadTile(0, {
        type: 'vector',
        source: 'source',
        uid: 0,
        tileID: { overscaledZ: 0, wrap: 0, canonical: { x: 0, y: 0, z: 0, w: 0 } }
      })
    );
  });
});
