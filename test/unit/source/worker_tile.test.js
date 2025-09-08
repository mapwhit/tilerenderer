import test from 'node:test';
import { Color } from '@mapwhit/style-expressions';
import Wrapper from '../../../src/source/geojson_wrapper.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import makeWorkerTile from '../../../src/source/worker_tile.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import { create as createLayers } from '../../util/layers.js';
import { loadVectorTile } from '../../util/tile.js';

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
  t.assert.equal(result.buckets.values().next().value.layers[0]._layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile.parse layer with layout property using global-state', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers(
      [
        {
          id: 'test',
          source: 'source',
          type: 'line',
          layout: {
            'line-join': ['global-state', 'test']
          }
        }
      ],
      { globalState: { test: 'bevel' } }
    )
  );

  const result = await makeWorkerTile(params, createLineWrapper(), layerIndex, {});
  t.assert.ok(result.buckets.values().next().value);
  t.assert.equal(result.buckets.values().next().value.layers[0]._layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile.parse layer with paint property using global-state', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers(
      [
        {
          id: 'test',
          source: 'source',
          type: 'fill-extrusion',
          paint: {
            'fill-extrusion-height': ['global-state', 'test']
          }
        }
      ],
      { globalState: { test: 1 } }
    )
  );

  const result = await makeWorkerTile(params, createLineWrapper(), layerIndex, {});
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

test('WorkerTile.parse vector tile', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'test',
        source: 'source',
        'source-layer': 'road',
        type: 'line',
        layout: {
          'line-join': 'bevel'
        }
      }
    ])
  );

  // Load a line feature from fixture tile.
  const vt = loadVectorTile();

  const result = await makeWorkerTile(params, vt, layerIndex, {});
  t.assert.ok(result.buckets.values().next().value);
  t.assert.equal(result.buckets.values().next().value.layers[0]._layout._values['line-join'].value.value, 'bevel');
});

test('WorkerTile.parse passes global-state to layers', async t => {
  const globalState = {};
  const layerIndex = new StyleLayerIndex(
    createLayers(
      [
        {
          id: 'layer-id',
          type: 'symbol',
          source: 'source',
          layout: {
            'text-size': ['global-state', 'size']
          }
        }
      ],
      { globalState }
    )
  );

  await makeWorkerTile(params, createLineWrapper(), layerIndex, {});
  globalState.size = 12;
  const layers = Array.from(layerIndex.familiesBySource.get('source').get('_geojsonTileLayer').values());
  const layer = layers[0][0];
  layer.recalculate({});
  t.assert.equal(layer._layout.get('text-size').evaluate({ zoom: 0 }), 12);
});

test('uses global state from parameters if not set on layer when recalculating layout properties', async t => {
  const layerIndex = new StyleLayerIndex(
    createLayers(
      [
        {
          id: 'circle',
          type: 'circle',
          source: 'source',
          paint: {
            'circle-color': ['global-state', 'color'],
            'circle-radius': ['global-state', 'radius']
          }
        }
      ],
      { globalState: { radius: 15, color: '#FF0000' } }
    )
  );

  await makeWorkerTile({ ...params }, createLineWrapper(), layerIndex, {});
  const layers = Array.from(layerIndex.familiesBySource.get('source').get('_geojsonTileLayer').values());
  const layer = layers[0][0];
  layer.recalculate({ zoom: 0, globalState: { radius: 15, color: '#FF0000' } });
  t.assert.deepEqual(layer._paint.get('circle-color').evaluate({ zoom: 0 }), new Color(1, 0, 0, 1));
  t.assert.equal(layer._paint.get('circle-radius').evaluate({ zoom: 0 }), 15);
});
