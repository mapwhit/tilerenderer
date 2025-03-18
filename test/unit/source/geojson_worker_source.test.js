const { test } = require('../../util/mapbox-gl-js-test');
const GeoJSONWorkerSource = require('../../../src/source/geojson_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const { OverscaledTileID } = require('../../../src/source/tile_id');

test('reloadTile', async t => {
  await t.test('does not rebuild vector data unless data has changed', (t, done) => {
    const layers = [
      {
        id: 'mylayer',
        source: 'sourceId',
        type: 'symbol'
      }
    ];
    const layerIndex = new StyleLayerIndex(layers);
    const source = new GeoJSONWorkerSource(null, layerIndex);
    const originalLoadVectorData = source.loadVectorData;
    let loadVectorCallCount = 0;
    source.loadVectorData = function (params, callback) {
      loadVectorCallCount++;
      return originalLoadVectorData.call(this, params, callback);
    };
    const geoJson = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      }
    };
    const tileParams = {
      source: 'sourceId',
      uid: 0,
      tileID: new OverscaledTileID(0, 0, 0, 0, 0),
      maxZoom: 10
    };

    function addData(callback) {
      source.loadData({ source: 'sourceId', data: JSON.stringify(geoJson) }, err => {
        t.assert.ifError(err);
        callback();
      });
    }

    function reloadTile(callback) {
      source.reloadTile(tileParams, (err, data) => {
        t.assert.ifError(err);
        return callback(data);
      });
    }

    addData(() => {
      // first call should load vector data from geojson
      let firstData;
      reloadTile(data => {
        firstData = data;
      });
      t.assert.equal(loadVectorCallCount, 1);

      // second call won't give us new rawTileData
      reloadTile(data => {
        t.assert.notOk('rawTileData' in data);
        data.rawTileData = firstData.rawTileData;
        t.assert.deepEqual(data, firstData);
      });

      // also shouldn't call loadVectorData again
      t.assert.equal(loadVectorCallCount, 1);

      // replace geojson data
      addData(() => {
        // should call loadVectorData again after changing geojson data
        reloadTile(data => {
          t.assert.ok('rawTileData' in data);
          t.assert.deepEqual(data, firstData);
        });
        t.assert.equal(loadVectorCallCount, 2);
        done();
      });
    });
  });
});
