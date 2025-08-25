import test from 'node:test';
import GeoJSONWorkerSource from '../../../src/source/geojson_worker_source.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import { create as createLayers } from '../../util/layers.js';

test('GeoJSONWorkerSource.constructor', t => {
  const resources = {};
  const layerIndex = new StyleLayerIndex();
  const source = new GeoJSONWorkerSource(resources, layerIndex);

  t.assert.equal(source.resources, resources);
  t.assert.equal(source.layerIndex, layerIndex);
});

test('GeoJSONWorkerSource.loadTile', async t => {
  const actor = {};
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'layer1',
        type: 'fill',
        source: 'source1',
        sourceLayer: 'layer1'
      }
    ])
  );
  const source = new GeoJSONWorkerSource(actor, layerIndex);

  const geojson = {
    type: 'LineString',
    coordinates: [
      [0, 90],
      [0, -90]
    ]
  };

  await source.loadData({ data: JSON.stringify(geojson) });

  // now loadTile can be called
  const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
  const result = await source.loadTile({ tileID, source: 'source1' });

  t.assert.ok(result);
  t.assert.equal(result.buckets.size, 1);
});
