const test = require('node:test');
const WorkerState = require('../../../src/source/worker_state');

test("isolates different instances' data", t => {
  const worker = new WorkerState();

  worker.setLayers(0, new Map([['one', { id: 'one', type: 'circle' }]]));
  worker.setLayers(1, new Map([['one', { id: 'one', type: 'circle' }]]));

  t.assert.notEqual(worker.getLayerIndex(0), worker.getLayerIndex(1));
});

test('creates a new Layer Index when needed', t => {
  const worker = new WorkerState();
  const layerIndex = worker.getLayerIndex(0);

  t.assert.ok(layerIndex, 'should create empty layer index');
  t.assert.equal(worker.getLayerIndex(0), layerIndex, 'should return the same layer index');
});
