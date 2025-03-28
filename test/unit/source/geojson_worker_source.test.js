const { test } = require('../../util/mapbox-gl-js-test');
const GeoJSONWorkerSource = require('../../../src/source/geojson_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const { OverscaledTileID } = require('../../../src/source/tile_id');

test('GeoJSONWorkerSource#constructor', t => {
  const resources = {};
  const layerIndex = new StyleLayerIndex();
  const source = new GeoJSONWorkerSource(resources, layerIndex);

  t.assert.equal(source.resources, resources);
  t.assert.equal(source.layerIndex, layerIndex);
});

test('GeoJSONWorkerSource#loadTile', async t => {
  const actor = {};
  const layerIndex = new StyleLayerIndex();
  layerIndex.update([
    {
      id: 'layer1',
      type: 'fill',
      source: 'source1',
      sourceLayer: 'layer1'
    }
  ]);
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
  t.assert.equal(result.buckets.length, 1);
});
