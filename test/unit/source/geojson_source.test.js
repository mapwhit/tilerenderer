import test from 'node:test';
import LngLat from '../../../src/geo/lng_lat.js';
import Transform from '../../../src/geo/transform.js';
import GeoJSONSource from '../../../src/source/geojson_source.js';
import makeTiler from '../../../src/source/geojson_tiler.js';
import Tile from '../../../src/source/tile.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import { waitForEvent } from '../../util/util.js';

test('GeoJSONSource.setData', async t => {
  function createSource(opts = {}) {
    Object.assign(opts, { data: {} });
    return new GeoJSONSource('id', opts, null, makeTiler());
  }

  await t.test('returns self', t => {
    const source = createSource();
    t.assert.equal(source.setData({}), source);
  });

  await t.test('fires "data" event', async () => {
    const source = createSource();
    const loadPromise = source.once('data');
    source.load();
    await loadPromise;
    const setDataPromise = source.once('data');
    source.setData({});
    await setDataPromise;
  });

  await t.test('fires "dataloading" event', (t, done) => {
    const source = createSource();
    source.on('dataloading', () => done());
    source.load();
  });

  await t.test('accepts stringified data', t => {
    const source = createSource();
    const geojson = {
      type: 'LineString',
      coordinates: [
        [0, 90],
        [0, -90]
      ]
    };
    t.assert.equal(source.setData(JSON.stringify(geojson)), source);
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
    const tiler = makeTiler();
    t.mock.method(tiler, 'loadData', () => {
      done();
      return Promise.resolve();
    });
    new GeoJSONSource('id', { data: {} }, null, tiler).load();
  });

  await t.test('forwards geojson-vt options with worker request', (t, done) => {
    const tiler = makeTiler();
    t.mock.method(tiler, 'loadData', params => {
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
      tiler
    ).load();
  });

  await t.test('forwards Supercluster options with worker request', (t, done) => {
    const tiler = makeTiler();
    t.mock.method(tiler, 'loadData', params => {
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
      tiler
    ).load();
  });

  await t.test('fires event when metadata loads', (t, done) => {
    const source = new GeoJSONSource('id', { data: {} }, null, makeTiler());

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        done();
      }
    });

    source.load();
  });

  await t.test('fires "error"', (t, done) => {
    const tiler = makeTiler();
    t.mock.method(tiler, 'loadData', () => {
      return Promise.reject('error');
    });
    const source = new GeoJSONSource('id', { data: {} }, null, tiler);

    source.on('error', err => {
      t.assert.equal(err.error, 'error');
      done();
    });

    source.load();
  });

  await t.test('sends loadData request to dispatcher after data update', (t, done) => {
    const tiler = makeTiler();
    t.mock.method(tiler, 'loadData', () => {
      done();
      return Promise.resolve();
    });

    const source = new GeoJSONSource('id', { data: {} }, null, tiler);
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

test('GeoJSONSource.updateData', async t => {
  function createSource(opts = {}) {
    Object.assign(opts, { data: {} });
    return new GeoJSONSource('source1', opts, null, makeTiler());
  }
  const geoJson = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    }
  };
  const updateableGeoJson = {
    type: 'Feature',
    id: 'point',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    },
    properties: {}
  };

  await t.test('updateData with geojson creates an non-updateable source', async t => {
    const source = createSource();
    source.setData(geoJson);
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');
    t.assert.throws(() => source.updateData({ source: 'source1', dataDiff: { removeAll: true } }), {
      message: 'Cannot update existing geojson data in source1'
    });
  });

  await t.test('updateData with geojson creates an updateable source', async () => {
    const source = createSource();
    source.setData(updateableGeoJson);
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');
    source.updateData({ removeAll: true });
  });

  await t.test('updateData with diff updates', async () => {
    const source = createSource();
    source.setData(updateableGeoJson);
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');
    source.updateData({
      add: [
        {
          type: 'Feature',
          id: 'update_point',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {}
        }
      ]
    });
  });
});
