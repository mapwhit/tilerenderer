import test from 'node:test';
import makeTiler from '../../../src/source/geojson_tiler.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import { create as createLayers } from '../../util/layers.js';

test('create GeoJSON tiler', t => {
  const resources = {};
  const layerIndex = new StyleLayerIndex();
  const tiler = makeTiler(resources, layerIndex);

  t.assert.equal(tiler.loadData instanceof Function, true);
  t.assert.equal(tiler.loadTile instanceof Function, true);
});

test('GeoJSON tiler.loadTile', async t => {
  const resources = {};
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
  const tiler = makeTiler(resources, layerIndex);

  const geojson = {
    type: 'LineString',
    coordinates: [
      [0, 90],
      [0, -90]
    ]
  };

  tiler.loadData({ data: geojson });

  // now loadTile can be called
  const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
  const result = await tiler.loadTile({ tileID, source: 'source1' });

  t.assert.ok(result);
  t.assert.equal(result.buckets.size, 1);
});

test('GeoJSON tiler.loadData', async t => {
  const resources = {};
  const layerIndex = new StyleLayerIndex(
    createLayers([
      {
        id: 'layer1',
        type: 'circle',
        source: 'source1',
        sourceLayer: 'layer1'
      }
    ])
  );
  const tiler = makeTiler(resources, layerIndex);
  const data = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        }
      }
    ]
  };

  await t.test('without clustering', async t => {
    tiler.loadData({ data });

    // now loadTile can be called
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const result = await tiler.loadTile({ tileID, source: 'source1' });

    t.assert.ok(result);
    t.assert.equal(result.buckets.size, 1);
    const bucket = result.buckets.get('layer1');
    const { segments } = bucket.segments;
    t.assert.equal(segments.length, 1);
    t.assert.equal(segments[0].vertexLength, 12);
  });

  await t.test('with clustering', async t => {
    tiler.loadData({ cluster: true, data });

    // now loadTile can be called
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const result = await tiler.loadTile({ tileID, source: 'source1' });

    t.assert.ok(result);
    t.assert.equal(result.buckets.size, 1);
    const bucket = result.buckets.get('layer1');
    const { segments } = bucket.segments;
    t.assert.equal(segments.length, 1);
    t.assert.equal(segments[0].vertexLength, 4);
  });
});
