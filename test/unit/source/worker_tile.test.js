const test = require('node:test');
const makeWorkerTile = require('../../../src/source/worker_tile');
const Wrapper = require('../../../src/source/geojson_wrapper');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const { create: createLayers } = require('../../util/layers');

const tileID = new OverscaledTileID(1, 0, 1, 1, 1);
const params = {
  uid: '',
  zoom: 0,
  maxZoom: 20,
  tileSize: 512,
  source: 'source',
  tileID,
  overscaling: 1
};

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

test('WorkerTile.parse', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test',
        source: 'source',
        type: 'circle'
      }
    ])
  );

  const result = await makeWorkerTile(params, createPointWrapper(), layerIndex, {});
  t.assert.ok(result.buckets.values().next().value);
});

test('WorkerTile.parse layer with layout property', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test',
        source: 'source',
        type: 'line',
        layout: {
          'line-join': 'bevel'
        }
      }
    ])
  );

  const result = await makeWorkerTile(params, createLineWrapper(), layerIndex, {});
  t.assert.ok(result.buckets.values().next().value);
  t.assert.equal(result.buckets.values().next().value.layers[0].layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile.parse layer with layout property using global-state', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test',
        source: 'source',
        type: 'line',
        layout: {
          'line-join': ['global-state', 'test']
        }
      }
    ])
  );

  const result = await makeWorkerTile(
    { ...params, globalState: { test: 'bevel' } },
    createLineWrapper(),
    layerIndex,
    {}
  );
  t.assert.ok(result.buckets.values().next().value);
  t.assert.equal(result.buckets.values().next().value.layers[0].layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile.parse layer with paint property using global-state', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test',
        source: 'source',
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-height': ['global-state', 'test']
        }
      }
    ])
  );

  const result = await makeWorkerTile({ ...params, globalState: { test: 1 } }, createLineWrapper(), layerIndex, {});
  const bucket = result.buckets.values().next().value;
  t.assert.ok(bucket);
  t.assert.equal(bucket.layers[0]._paint._values['fill-extrusion-height'].value.value, 1);
});

test('WorkerTile.parse skips hidden layers', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test-hidden',
        source: 'source',
        type: 'fill',
        layout: { visibility: 'none' }
      }
    ])
  );

  const result = await makeWorkerTile(params, createPointWrapper(), layerIndex, {});
  t.assert.equal(result.buckets.size, 0);
});

test('WorkerTile.parse skips layers without a corresponding source layer', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test',
        source: 'source',
        'source-layer': 'nonesuch',
        type: 'fill'
      }
    ])
  );

  const result = await makeWorkerTile(params, { layers: {} }, layerIndex, {});
  t.assert.equal(result.buckets.size, 0);
});
