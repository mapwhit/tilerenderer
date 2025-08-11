const test = require('node:test');
const VectorTileWorkerSource = require('../../../src/source/vector_tile_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

test('VectorTileWorkerSource.constructor', t => {
  const resources = {};
  const layerIndex = new StyleLayerIndex();
  const source = new VectorTileWorkerSource(resources, layerIndex);

  t.assert.equal(source.resources, resources);
  t.assert.equal(source.layerIndex, layerIndex);
});

test('VectorTileWorkerSource.loadTile - no response', async t => {
  const actor = {};
  const layerIndex = new StyleLayerIndex();
  const source = new VectorTileWorkerSource(actor, layerIndex);

  const params = {
    tileID: {
      overscaledZ: 0,
      wrap: 0,
      canonical: {
        z: 0,
        x: 0,
        y: 0
      }
    },
    response: null
  };

  await t.assert.rejects(source.loadTile(params), { message: 'no tile data' });
});

test('VectorTileWorkerSource.loadTile - no data', async t => {
  const actor = {};
  const layerIndex = new StyleLayerIndex();
  const source = new VectorTileWorkerSource(actor, layerIndex);

  const params = {
    tileID: {
      overscaledZ: 0,
      wrap: 0,
      canonical: {
        z: 0,
        x: 0,
        y: 0
      }
    },
    response: {}
  };

  const result = await source.loadTile(params);
  t.assert.equal(result, null);
});
