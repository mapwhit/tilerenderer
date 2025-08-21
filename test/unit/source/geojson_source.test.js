const test = require('node:test');
const Tile = require('../../../src/source/tile');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const GeoJSONSource = require('../../../src/source/geojson_source');
const Transform = require('../../../src/geo/transform');
const LngLat = require('../../../src/geo/lng_lat');
const GeoJSONWorkerSource = require('../../../src/source/geojson_worker_source');

const hawkHill = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.48369693756104, 37.83381888486939],
          [-122.48348236083984, 37.83317489144141],
          [-122.48339653015138, 37.83270036637107],
          [-122.48356819152832, 37.832056363179625],
          [-122.48404026031496, 37.83114119107971],
          [-122.48404026031496, 37.83049717427869],
          [-122.48348236083984, 37.829920943955045],
          [-122.48356819152832, 37.82954808664175],
          [-122.48507022857666, 37.82944639795659],
          [-122.48610019683838, 37.82880236636284],
          [-122.48695850372314, 37.82931081282506],
          [-122.48700141906738, 37.83080223556934],
          [-122.48751640319824, 37.83168351665737],
          [-122.48803138732912, 37.832158048267786],
          [-122.48888969421387, 37.83297152392784],
          [-122.48987674713133, 37.83263257682617],
          [-122.49043464660643, 37.832937629287755],
          [-122.49125003814696, 37.832429207817725],
          [-122.49163627624512, 37.832564787218985],
          [-122.49223709106445, 37.83337825839438],
          [-122.49378204345702, 37.83368330777276]
        ]
      }
    }
  ]
};

test('GeoJSONSource.setData', async t => {
  function createSource(opts = {}) {
    Object.assign(opts, { data: {} });
    return new GeoJSONSource('id', opts, null, {});
  }

  await t.test('returns self', t => {
    const source = createSource();
    t.assert.equal(source.setData({}), source);
  });

  await t.test('fires "data" event', (t, done) => {
    const source = createSource();
    source.once('data', () => {
      source.once('data', () => done());
      source.setData({});
    });
    source.load();
  });

  await t.test('fires "dataloading" event', (t, done) => {
    const source = createSource();
    source.on('dataloading', () => done());
    source.load();
  });
});

test('GeoJSONSource.update', async t => {
  const transform = new Transform();
  transform.resize(200, 200);
  const lngLat = LngLat.convert([-122.486052, 37.830348]);
  const point = transform.locationPoint(lngLat);
  transform.zoom = 15;
  transform.setLocationAtPoint(lngLat, point);

  await t.test('sends initial loadData request to dispatcher', (t, done) => {
    const loadData = t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', () => {
      done();
      return Promise.resolve();
    });

    new GeoJSONSource('id', { data: {} }, null, {}).load();
  });

  await t.test('forwards geojson-vt options with worker request', (t, done) => {
    const loadData = t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', params => {
      t.assert.deepEqual(params.geojsonVtOptions, {
        extent: 8192,
        maxZoom: 10,
        tolerance: 4,
        buffer: 256,
        lineMetrics: false
      });
      done();

      return Promise.resolve();
    });

    new GeoJSONSource(
      'id',
      {
        data: {},
        maxzoom: 10,
        tolerance: 0.25,
        buffer: 16
      },
      null,
      {}
    ).load();
  });

  await t.test('fires event when metadata loads', (t, done) => {
    const source = new GeoJSONSource('id', { data: {} }, null, {});

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        done();
      }
    });

    source.load();
  });

  await t.test('fires "error"', (t, done) => {
    const loadData = t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', () => {
      return Promise.reject('error');
    });

    const source = new GeoJSONSource('id', { data: {} }, null, {});

    source.on('error', err => {
      t.assert.equal(err.error, 'error');
      done();
    });

    source.load();
  });

  await t.test('sends loadData request to dispatcher after data update', (t, done) => {
    const loadData = t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', () => {
      done();
      return Promise.resolve();
    });

    const source = new GeoJSONSource('id', { data: {} }, null, {});
    source.map = {
      transform: {},
      getGlobalState: () => ({})
    };

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        source.setData({});
        source.loadTile(new Tile(new OverscaledTileID(0, 0, 0, 0, 0), 512), () => {});
      }
    });

    source.load();
  });
});
