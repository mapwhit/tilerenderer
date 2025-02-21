const { test } = require('../../util/mapbox-gl-js-test');
const RasterDEMTileWorkerSource = require('../../../src/source/raster_dem_tile_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const DEMData = require('../../../src/data/dem_data');

test('loadTile', async t => {
  await t.test('loads DEM tile', (t, done) => {
    const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

    source.loadTile(
      {
        source: 'source',
        uid: 0,
        rawImageData: { data: new Uint8ClampedArray(256), height: 8, width: 8 },
        dim: 256
      },
      (err, data) => {
        if (err) t.assert.fail();
        t.assert.ok(data instanceof DEMData, 'returns DEM data');

        source.removeTile({ uid: 0 });
        done();
      }
    );
  });
});
