const { test } = require('../../util/mapbox-gl-js-test');
const WorkerTile = require('../../../src/source/worker_tile');
const Wrapper = require('../../../src/source/geojson_wrapper');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const StyleLayerIndex = require('../../../src/style/style_layer_index');

function createWorkerTile() {
  return new WorkerTile({
    uid: '',
    zoom: 0,
    maxZoom: 20,
    tileSize: 512,
    source: 'source',
    tileID: new OverscaledTileID(1, 0, 1, 1, 1),
    overscaling: 1
  });
}

function createWrapper() {
  return new Wrapper([
    {
      type: 1,
      geometry: [0, 0],
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
  const result = await tile.parse(createWrapper(), layerIndex, {});
  t.assert.ok(result.buckets[0]);
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
  const result = await tile.parse(createWrapper(), layerIndex, {});
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

  t.stub(console, 'warn');

  const tile = createWorkerTile();
  const result = await tile.parse(data, layerIndex, {});
  t.assert.ok(console.warn.calledWithMatch(/does not use vector tile spec v2/));
});
