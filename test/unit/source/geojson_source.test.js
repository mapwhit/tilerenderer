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
    const errorPromise = waitForEvent(source, 'error', () => true);
    source.updateData({ removeAll: true });
    const error = await errorPromise;
    t.assert.equal(error.error.message, 'Cannot update existing geojson data in source1');
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

  await t.test('queues a second call to updateData', async t => {
    const tiler = makeTiler();
    const loadData = t.mock.method(tiler, 'loadData');

    const source = new GeoJSONSource('id', { data: { type: 'FeatureCollection', features: [] } }, null, tiler);
    // Wait for initial data to be loaded
    source.load();
    await waitForEvent(source, 'data', e => e.sourceDataType === 'metadata');
    // Call updateData multiple times while the worker is still processing the initial data
    const update1 = {
      remove: ['1'],
      add: [{ id: '2', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }],
      update: [{ id: '3', addOrUpdateProperties: [], newGeometry: { type: 'LineString', coordinates: [] } }]
    };
    const update2 = {
      remove: ['4'],
      add: [{ id: '5', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }],
      update: [{ id: '6', addOrUpdateProperties: [], newGeometry: { type: 'LineString', coordinates: [] } }]
    };
    source.updateData(update1);
    source.updateData(update2);
    // Wait for both updateData calls to be performed
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');

    t.assert.equal(loadData.mock.callCount(), 3);
    t.assert.deepEqual(loadData.mock.calls[0].arguments[0].data, { type: 'FeatureCollection', features: [] });
    t.assert.deepEqual(loadData.mock.calls[1].arguments[0].data, {
      type: 'FeatureCollection',
      features: [{ id: '2', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }]
    });
    t.assert.deepEqual(loadData.mock.calls[2].arguments[0].data, {
      type: 'FeatureCollection',
      features: [
        { id: '2', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        { id: '5', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      ]
    });
  });

  await t.test('combines multiple diffs when data is loading', async t => {
    const tiler = makeTiler();
    const loadData = t.mock.method(tiler, 'loadData');

    const source = new GeoJSONSource('id', { data: {} }, null, tiler);
    // Perform an initial setData
    const data1 = { type: 'FeatureCollection', features: [] };
    source.setData(data1);
    // Call updateData multiple times while the worker is still processing the initial data
    const update1 = {
      remove: ['1'],
      add: [{ id: '2', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }],
      update: [{ id: '3', addOrUpdateProperties: [], newGeometry: { type: 'LineString', coordinates: [] } }]
    };
    const update2 = {
      remove: ['4'],
      add: [{ id: '5', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }],
      update: [
        { id: '3', addOrUpdateProperties: [], newGeometry: { type: 'Point', coordinates: [] } },
        { id: '6', addOrUpdateProperties: [], newGeometry: { type: 'LineString', coordinates: [] } }
      ]
    };
    source.updateData(update1);
    source.updateData(update2);
    // Wait for the setData and updateData calls to be performed
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');

    t.assert.equal(loadData.mock.callCount(), 2);
    t.assert.deepEqual(loadData.mock.calls[0].arguments[0].data, data1);
    t.assert.deepEqual(loadData.mock.calls[1].arguments[0].data, {
      type: 'FeatureCollection',
      features: [
        {
          geometry: {
            coordinates: [],
            type: 'LineString'
          },
          id: '2',
          properties: {},
          type: 'Feature'
        },
        {
          geometry: {
            coordinates: [],
            type: 'LineString'
          },
          id: '5',
          properties: {},
          type: 'Feature'
        }
      ]
    });
  });

  await t.test('is overwritten by a subsequent call to setData when data is loading', async t => {
    const tiler = makeTiler();
    const loadData = t.mock.method(tiler, 'loadData');

    const source = new GeoJSONSource('id', { data: {} }, null, tiler);
    // Perform an initial setData
    const data1 = { type: 'FeatureCollection', features: [] };
    source.setData(data1);
    // Queue an updateData
    const update1 = {
      remove: ['1'],
      add: [{ id: '2', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }],
      update: [{ id: '3', addOrUpdateProperties: [], newGeometry: { type: 'LineString', coordinates: [] } }]
    };
    source.updateData(update1);
    // Call setData while the worker is still processing the initial data
    const data2 = {
      type: 'FeatureCollection',
      features: [{ id: '1', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }]
    };
    source.setData(data2);
    // Wait for both setData calls to be performed
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');

    t.assert.equal(loadData.mock.callCount(), 2);
    t.assert.deepEqual(loadData.mock.calls[0].arguments[0].data, data1);
    t.assert.deepEqual(loadData.mock.calls[0].arguments[0].diff, undefined);
    t.assert.deepEqual(loadData.mock.calls[1].arguments[0].data, data2);
    t.assert.deepEqual(loadData.mock.calls[1].arguments[0].diff, undefined);
  });

  await t.test('is queued after setData when data is loading', async t => {
    const tiler = makeTiler();
    const loadData = t.mock.method(tiler, 'loadData');

    const source = new GeoJSONSource('id', { data: {} }, null, tiler);
    // Perform an initial setData
    const data1 = { type: 'FeatureCollection', features: [] };
    source.setData(data1);
    // Queue a setData
    const data2 = {
      type: 'FeatureCollection',
      features: [{ id: 4, type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }]
    };
    source.setData(data2);
    // Queue an updateData
    const update1 = {
      remove: ['1'],
      add: [{ id: '2', type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }],
      update: [{ id: '3', addOrUpdateProperties: [], newGeometry: { type: 'LineString', coordinates: [] } }]
    };
    source.updateData(update1);
    // Wait for the calls to be performed
    await waitForEvent(source, 'data', e => e.sourceDataType === 'content');

    t.assert.equal(loadData.mock.callCount(), 2);
    t.assert.deepEqual(loadData.mock.calls[0].arguments[0].data, data1);
    t.assert.deepEqual(loadData.mock.calls[1].arguments[0].data, {
      type: 'FeatureCollection',
      features: [
        { id: 4, type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        {
          geometry: {
            coordinates: [],
            type: 'LineString'
          },
          id: '2',
          properties: {},
          type: 'Feature'
        }
      ]
    });
  });
});

test('GeoJSONSource.getData', async t => {
  function createSource(opts = {}) {
    Object.assign(opts, { data: {} });
    return new GeoJSONSource('source1', opts, null, makeTiler());
  }
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
  const updateableGeoJson = {
    type: 'Feature',
    id: 'point',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    },
    properties: {}
  };

  await t.test('getData returns correct geojson when the source was loaded with geojson', async t => {
    const source = new GeoJSONSource('id', { data: hawkHill }, null, makeTiler());
    source.load();
    t.assert.deepEqual(await source.getData(), hawkHill);
  });

  await t.test('getData after diff updates returns updated geojson', async t => {
    const source = createSource();
    source.setData(updateableGeoJson);
    t.assert.deepEqual(await source.getData(), updateableGeoJson);
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
    t.assert.deepEqual(await source.getData(), {
      type: 'FeatureCollection',
      features: [
        { ...updateableGeoJson },
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

test('GeoJSONSource.load', async t => {
  await t.test('is noop when all data is already loaded', async t => {
    const warn = t.mock.method(console, 'warn');
    const tiler = makeTiler();
    const loadData = t.mock.method(tiler, 'loadData');

    const source = new GeoJSONSource('id', { data: {} }, null, tiler);
    // Wait for initial data to be loaded
    source.load();
    await waitForEvent(source, 'data', e => e.sourceDataType === 'metadata');
    // Run again, with no additional data loaded
    source.load();
    t.assert.equal(loadData.mock.callCount(), 1);
    t.assert.equal(warn.mock.callCount(), 1);
    t.assert.match(warn.mock.calls[0].arguments[0], /No data or diff provided to GeoJSONSource id\./);
  });
});
