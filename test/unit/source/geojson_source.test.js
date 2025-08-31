import test from 'node:test';
import LngLat from '../../../src/geo/lng_lat.js';
import Transform from '../../../src/geo/transform.js';
import GeoJSONSource from '../../../src/source/geojson_source.js';
import GeoJSONWorkerSource from '../../../src/source/geojson_worker_source.js';
import Tile from '../../../src/source/tile.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';

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
    t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', () => {
      done();
      return Promise.resolve();
    });

    new GeoJSONSource('id', { data: {} }, null, {}).load();
  });

  await t.test('forwards geojson-vt options with worker request', (t, done) => {
    t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', params => {
      t.assert.deepEqual(params.geojsonVtOptions, {
        extent: 8192,
        maxZoom: 10,
        tolerance: 4,
        buffer: 256,
        lineMetrics: false,
        generateId: true
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
        buffer: 16,
        generateId: true
      },
      null,
      {}
    ).load();
  });

  await t.test('forwards Supercluster options with worker request', (t, done) => {
    t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', params => {
      t.assert.deepEqual(params.superclusterOptions, {
        maxZoom: 12,
        extent: 8192,
        radius: 1600,
        log: false,
        generateId: true
      });
      done();

      return Promise.resolve();
    });

    new GeoJSONSource(
      'id',
      {
        data: {},
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 100,
        generateId: true
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
    t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', () => {
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
    t.mock.method(GeoJSONWorkerSource.prototype, 'loadData', () => {
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
