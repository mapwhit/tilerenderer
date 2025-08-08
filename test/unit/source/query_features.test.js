const test = require('node:test');
const { queryRenderedFeatures, querySourceFeatures } = require('../../../src/source/query_features.js');
const SourceCache = require('../../../src/source/source_cache.js');
const Transform = require('../../../src/geo/transform.js');

test('QueryFeatures.rendered', async t => {
  await t.test('returns empty object if source returns no tiles', t => {
    const mockSourceCache = {
      tilesIn: function () {
        return [];
      }
    };
    const transform = new Transform();
    const result = queryRenderedFeatures(mockSourceCache, undefined, {}, undefined, transform);
    t.assert.deepEqual(result, {});
  });
});

test('QueryFeatures.source', async t => {
  await t.test('returns empty result when source has no features', t => {
    const sourceCache = new SourceCache(
      'test',
      {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      },
      {
        send: function (type, params, callback) {
          return callback();
        }
      }
    );
    const result = querySourceFeatures(sourceCache, {});
    t.assert.deepEqual(result, []);
  });
});
