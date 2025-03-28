const { test } = require('../../util/mapbox-gl-js-test');
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

test("isolates different instances' data", t => {
  const worker = new Worker(_self);

  worker.setLayers(0, [{ id: 'one', type: 'circle' }]);

  worker.setLayers(1, [
    { id: 'one', type: 'circle' },
    { id: 'two', type: 'circle' }
  ]);

  t.assert.notEqual(worker.layerIndexes[0], worker.layerIndexes[1]);
});
