const { test } = require('../../util/mapbox-gl-js-test');
const VectorTileWorkerSource = require('../../../src/source/vector_tile_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

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
  const parse = t.spy(() => Promise.resolve({}));

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  await source.reloadTile({ uid: 0 });
  t.assert.equal(parse.callCount, 1);
});

test('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', async t => {
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
  const parse = t.spy(() => Promise.resolve({}));

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  source.reloadTile({ uid: 0 });
  t.assert.equal(parse.callCount, 1);

  const p2 = source.reloadTile({ uid: 0 });
  t.assert.equal(parse.callCount, 1);

  await p2;
  t.assert.equal(parse.callCount, 2);
});

test('VectorTileWorkerSource#reloadTile handles multiple pending reloads', async t => {
  // https://github.com/mapbox/mapbox-gl-js/issues/6308
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
  const parse = t.spy(() => Promise.resolve({}));

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  source.reloadTile({ uid: 0 });
  t.assert.equal(parse.callCount, 1);

  source.reloadTile({ uid: 0 });
  t.assert.equal(parse.callCount, 1);
  const p3 = source.reloadTile({ uid: 0 });

  await p3;
  t.assert.equal(parse.callCount, 3);
});
