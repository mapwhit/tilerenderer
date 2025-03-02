const { test } = require('../../../util/mapbox-gl-js-test');
const VectorTileWorkerSource = require('../../../../src/worker/source/vector_tile_worker_source');
const StyleLayerIndex = require('../../../../src/style/style_layer_index');

test('VectorTileWorkerSource#removeTile removes loaded tile', t => {
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());

  source.loaded = {
    0: {}
  };

  source.removeTile({
    source: 'source',
    uid: 0
  });

  t.assert.deepEqual(source.loaded, {});
});

test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', async t => {
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
  const parse = t.spy();

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  await source.reloadTile({ uid: 0 });
  t.assert.equal(parse.callCount, 1);
});
