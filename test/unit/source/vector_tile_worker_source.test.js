const { test } = require('../../util/mapbox-gl-js-test');
const VectorTileWorkerSource = require('../../../src/source/vector_tile_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

test('VectorTileWorkerSource#removeTile removes loaded tile', t => {
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());

  source.loaded = {
    0: {}
  };

  source.removeTile(
    {
      source: 'source',
      uid: 0
    },
    (err, res) => {
      t.assert.notOk(err);
      t.assert.notOk(res);
    }
  );

  t.assert.deepEqual(source.loaded, {});
});

test('VectorTileWorkerSource#reloadTile reloads a previously-loaded tile', t => {
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
  const parse = t.spy(() => Promise.resolve({}));

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  const callback = t.spy();
  source.reloadTile({ uid: 0 }, callback);
  t.assert.equal(parse.callCount, 1);

  // parse.firstCall.args[3]();
  t.assert.equal(callback.callCount, 1);
});

test('VectorTileWorkerSource#reloadTile queues a reload when parsing is in progress', t => {
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
  const parse = t.spy(() => Promise.resolve({}));

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  const callback1 = t.spy();
  const callback2 = t.spy();
  source.reloadTile({ uid: 0 }, callback1);
  t.assert.equal(parse.callCount, 1);

  source.loaded[0].status = 'parsing';
  source.reloadTile({ uid: 0 }, callback2);
  t.assert.equal(parse.callCount, 1);

  parse.firstCall.args[3]();
  t.assert.equal(parse.callCount, 2);
  t.assert.equal(callback1.callCount, 1);
  t.assert.equal(callback2.callCount, 0);

  parse.secondCall.args[3]();
  t.assert.equal(callback1.callCount, 1);
  t.assert.equal(callback2.callCount, 1);
});

test('VectorTileWorkerSource#reloadTile handles multiple pending reloads', t => {
  // https://github.com/mapbox/mapbox-gl-js/issues/6308
  const source = new VectorTileWorkerSource(null, new StyleLayerIndex());
  const parse = t.spy(() => Promise.resolve({}));

  source.loaded = {
    0: {
      status: 'done',
      parse
    }
  };

  const callback1 = t.spy();
  const callback2 = t.spy();
  const callback3 = t.spy();
  source.reloadTile({ uid: 0 }, callback1);
  t.assert.equal(parse.callCount, 1);

  source.loaded[0].status = 'parsing';
  source.reloadTile({ uid: 0 }, callback2);
  t.assert.equal(parse.callCount, 1);

  parse.firstCall.args[3]();
  t.assert.equal(parse.callCount, 2);
  t.assert.equal(callback1.callCount, 1);
  t.assert.equal(callback2.callCount, 0);
  t.assert.equal(callback3.callCount, 0);

  source.reloadTile({ uid: 0 }, callback3);
  t.assert.equal(parse.callCount, 2);
  t.assert.equal(callback1.callCount, 1);
  t.assert.equal(callback2.callCount, 0);
  t.assert.equal(callback3.callCount, 0);

  parse.secondCall.args[3]();
  t.assert.equal(parse.callCount, 3);
  t.assert.equal(callback1.callCount, 1);
  t.assert.equal(callback2.callCount, 1);
  t.assert.equal(callback3.callCount, 0);

  parse.thirdCall.args[3]();
  t.assert.equal(callback1.callCount, 1);
  t.assert.equal(callback2.callCount, 1);
  t.assert.equal(callback3.callCount, 1);
});
