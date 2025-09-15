import test from 'node:test';
import { CollisionBoxArray } from '../../../src/data/array_types.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import Transform from '../../../src/geo/transform.js';
import GeoJSONWrapper from '../../../src/source/geojson_wrapper.js';
import Tile from '../../../src/source/tile.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import CircleStyleLayer from '../../../src/style/style_layer/circle_style_layer.js';

test('query', async t => {
  const features = [
    {
      type: 1,
      geometry: [0, 0],
      tags: { cluster: true }
    }
  ];
  const tileID = new OverscaledTileID(3, 0, 2, 1, 2);
  const tile = new Tile(tileID, undefined);
  const vectorTile = new GeoJSONWrapper(features);
  tile.loadVectorData(
    createVectorData({
      vectorTile
    }),
    createPainter()
  );
  const transform = new Transform();
  transform.resize(500, 500);

  await t.test('filter with global-state', t => {
    const layer = new CircleStyleLayer('layer', { source: 'source', paint: {} });
    layer.recalculate({});

    const featureIndex = new FeatureIndex(tileID);
    featureIndex.vectorTile = vectorTile;
    featureIndex.bucketLayerIDs = [['layer']];
    featureIndex.insert(features[0], [[{ x: 1, y: 1 }]], 0, 0, 0);

    const result = featureIndex.query(
      {
        queryPadding: 0,
        tileSize: 512,
        scale: 1,
        queryGeometry: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ],
        cameraQueryGeometry: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ],
        params: {
          filter: ['==', ['get', 'cluster'], ['global-state', 'isCluster']],
          globalState: { isCluster: true }
        },
        pixelPosMatrix: transform.pixelMatrix,
        transform
      },
      new Map([['layer', layer]])
    );
    t.assert.deepEqual(result.layer[0].feature.properties, features[0].tags);
  });
});

function createVectorData(options) {
  const collisionBoxArray = new CollisionBoxArray();
  return Object.assign(
    {
      collisionBoxArray,
      featureIndex: new FeatureIndex(new OverscaledTileID(1, 0, 1, 1, 1)),
      buckets: new Map()
    },
    options
  );
}

function createPainter() {
  return { style: {} };
}
