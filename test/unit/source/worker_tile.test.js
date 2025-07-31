const test = require('node:test');
const WorkerTile = require('../../../src/source/worker_tile');
const Wrapper = require('../../../src/source/geojson_wrapper');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

function createWorkerTile(params = {}) {
  return new WorkerTile({
    uid: '',
    zoom: 0,
    maxZoom: 20,
    tileSize: 512,
    source: 'source',
    tileID: new OverscaledTileID(1, 0, 1, 1, 1),
    overscaling: 1,
    ...params
  });
}

function createPointWrapper() {
  return new Wrapper([
    {
      type: 1,
      geometry: [0, 0],
      tags: {}
    }
  ]);
}

function createLineWrapper() {
  return new Wrapper([
    {
      type: 2,
      geometry: [
        [0, 0],
        [1, 1]
      ],
      tags: {}
    }
  ]);
}

test('WorkerTile#parse', async t => {
  const layerIndex = new StyleLayerIndex([
    {
      id: 'test',
      source: 'source',
      type: 'circle'
    }
  ]);

  const tile = createWorkerTile();
  const result = await tile.parse(createPointWrapper(), layerIndex, {});
  t.assert.ok(result.buckets[0]);
});

test('WorkerTile#parse layer with layout property', async t => {
  const layerIndex = new StyleLayerIndex([
    {
      id: 'test',
      source: 'source',
      type: 'line',
      layout: {
        'line-join': 'bevel'
      }
    }
  ]);

  const tile = createWorkerTile();
  const result = await tile.parse(createLineWrapper(), layerIndex, {});
  t.assert.ok(result.buckets[0]);
  t.assert.ok(result.buckets[0]);
  t.assert.equal(result.buckets[0].layers[0].layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile#parse layer with layout property using global-state', async t => {
  const layerIndex = new StyleLayerIndex([
    {
      id: 'test',
      source: 'source',
      type: 'line',
      layout: {
        'line-join': ['global-state', 'test']
      }
    }
  ]);

  const tile = createWorkerTile({
    globalState: { test: 'bevel' }
  });
  const result = await tile.parse(createLineWrapper(), layerIndex, {});
  t.assert.ok(result.buckets[0]);
  t.assert.ok(result.buckets[0]);
  t.assert.equal(result.buckets[0].layers[0].layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile#parse skips hidden layers', async t => {
  const layerIndex = new StyleLayerIndex([
    {
      id: 'test-hidden',
      source: 'source',
      type: 'fill',
      layout: { visibility: 'none' }
    }
  ]);

  const tile = createWorkerTile();
  const result = await tile.parse(createPointWrapper(), layerIndex, {});
  t.assert.equal(result.buckets.length, 0);
});

test('WorkerTile#parse skips layers without a corresponding source layer', async t => {
  const layerIndex = new StyleLayerIndex([
    {
      id: 'test',
      source: 'source',
      'source-layer': 'nonesuch',
      type: 'fill'
    }
  ]);

  const tile = createWorkerTile();
  const result = await tile.parse({ layers: {} }, layerIndex, {});
  t.assert.equal(result.buckets.length, 0);
});

test('WorkerTile#parse warns once when encountering a v1 vector tile layer', async t => {
  const layerIndex = new StyleLayerIndex([
    {
      id: 'test',
      source: 'source',
      'source-layer': 'test',
      type: 'fill'
    }
  ]);

  const data = {
    layers: {
      test: {
        version: 1
      }
    }
  };

  t.mock.method(console, 'warn');

  const tile = createWorkerTile();
  await tile.parse(data, layerIndex, {});
  t.assert.match(console.warn.mock.calls[0].arguments[0], /does not use vector tile spec v2/);
});
