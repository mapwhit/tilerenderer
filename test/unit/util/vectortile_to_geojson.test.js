import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import GeoJSONFeature from '../../../src/util/vectortile_to_geojson.js';

test('vector tile to GeoJSON', async t => {
  const data = await readPbf('14-8801-5371.vector.pbf');
  const tile = new VectorTile(new Protobuf(data));

  t.beforeEach(t => {
    t.assert.equalCoordinates = assertEqualCoordinates;
  });

  await t.test('poi_label feature conversion', t => {
    const vtf = tile.layers.poi_label.feature(11);
    const f = new GeoJSONFeature(vtf, 14, 8801, 5371);
    t.assert.equal(f.type, 'Feature');
    t.assert.equal(f.id, 3000003150561);
    t.assert.deepEqual(f.properties, {
      localrank: 1,
      maki: 'park',
      name: 'Mauerpark',
      name_de: 'Mauerpark',
      name_en: 'Mauerpark',
      name_es: 'Mauerpark',
      name_fr: 'Mauerpark',
      osm_id: 3000003150561,
      ref: '',
      scalerank: 2,
      type: 'Park'
    });
    t.assert.equal(f.geometry.type, 'Point');
    t.assert.equalCoordinates(f.geometry.coordinates, [13.402258157730103, 52.54398925380624]);
  });

  await t.test('bridge feature conversion', t => {
    const vtf = tile.layers.bridge.feature(0);
    const f = new GeoJSONFeature(vtf, 14, 8801, 5371);
    t.assert.equal(f.type, 'Feature');
    t.assert.equal(f.id, 238162948);
    t.assert.deepEqual(f.properties, {
      class: 'service',
      oneway: 0,
      osm_id: 238162948,
      type: 'service'
    });
    t.assert.equal(f.geometry.type, 'LineString');
    t.assert.equalCoordinates(f.geometry.coordinates, [
      [13.399457931518555, 52.546334844036416],
      [13.399441838264465, 52.546504478525016]
    ]);
  });

  await t.test('building feature conversion', t => {
    const vtf = tile.layers.building.feature(0);
    const f = new GeoJSONFeature(vtf, 14, 8801, 5371);
    t.assert.equal(f.type, 'Feature');
    t.assert.equal(f.id, 1000267229912);
    t.assert.deepEqual(f.properties, {
      osm_id: 1000267229912
    });
    t.assert.equal(f.geometry.type, 'Polygon');
    t.assert.equalCoordinates(f.geometry.coordinates, [
      [
        [13.392285704612732, 52.54974045706258],
        [13.392264246940613, 52.549737195107554],
        [13.392248153686523, 52.549737195107554],
        [13.392248153686523, 52.54974045706258],
        [13.392285704612732, 52.54974045706258]
      ]
    ]);
  });

  // https://github.com/mapbox/vector-tile-spec/issues/30
  await t.test('singleton multi-point conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('singleton-multi-point');
    t.assert.equal(type, 'Point');
    t.assert.equalCoordinates(coordinates, [1, 2], 1e-1);
  });

  await t.test('singleton multi-line conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('singleton-multi-line');
    t.assert.equal(type, 'LineString');
    t.assert.equalCoordinates(
      coordinates,
      [
        [1, 2],
        [3, 4]
      ],
      1e-1
    );
  });

  await t.test('singleton multi-polygon conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('singleton-multi-polygon');
    t.assert.equal(type, 'Polygon');

    t.assert.equalCoordinates(
      coordinates,
      [
        [
          [1, 0],
          [0, 0],
          [1, 1],
          [1, 0]
        ]
      ],
      1e-1
    );
  });

  await t.test('multi-point conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('multi-point');
    t.assert.equal(type, 'MultiPoint');

    t.assert.equalCoordinates(
      coordinates,
      [
        [1, 2],
        [3, 4]
      ],
      1e-1
    );
  });

  await t.test('multi-line conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('multi-line');
    t.assert.equal(type, 'MultiLineString');

    t.assert.equalCoordinates(
      coordinates,
      [
        [
          [1, 2],
          [3, 4]
        ],
        [
          [5, 6],
          [7, 8]
        ]
      ],
      1e-1
    );
  });

  await t.test('multi-polygon conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('multi-polygon');
    t.assert.equal(type, 'MultiPolygon');

    t.assert.equalCoordinates(
      coordinates,
      [
        [
          [
            [1, 0],
            [0, 0],
            [1, 1],
            [1, 0]
          ]
        ],
        [
          [
            [-1, -1],
            [-1, 0],
            [0, 0],
            [-1, -1]
          ]
        ]
      ],
      1e-1
    );
  });

  // https://github.com/mapbox/vector-tile-js/issues/32
  await t.test('polygon with inner ring conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('polygon-with-inner');
    t.assert.equal(type, 'Polygon');

    t.assert.equalCoordinates(
      coordinates,
      [
        [
          [2, -2],
          [-2, -2],
          [-2, 2],
          [2, 2],
          [2, -2]
        ],
        [
          [-1, 1],
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1]
        ]
      ],
      1e-1
    );
  });

  await t.test('stacked multipolygon conversion', async t => {
    const { type, coordinates } = await geoJSONFromFixture('stacked-multipolygon');
    t.assert.equal(type, 'MultiPolygon');

    t.assert.equalCoordinates(
      coordinates,
      [
        [
          [
            [2, -2],
            [-2, -2],
            [-2, 2],
            [2, 2],
            [2, -2]
          ]
        ],
        [
          [
            [1, -1],
            [-1, -1],
            [-1, 1],
            [1, 1],
            [1, -1]
          ]
        ]
      ],
      1e-1
    );
  });
});

function assertEqualCoordinates(a, b, epsilon = 1e-6) {
  const assert = this;

  assert.ok(Array.isArray(a), 'should be an array');
  assert.ok(Array.isArray(b), 'should be an array');

  assert.equal(a.length, b.length, 'should have the same length');

  if (Array.isArray(a[0])) {
    for (let i = 0; i < a.length; i++) {
      assertEqualCoordinates.call(this, a[i], b[i], epsilon);
    }
  } else {
    for (let i = 0; i < a.length; i++) {
      assert.ok(
        Math.abs(a[i] - b[i]) < epsilon,
        `difference between ${a[i]} and ${b[i]} should be smaller than ${epsilon}`
      );
    }
  }
}

function readPbf(name) {
  const filename = path.resolve(import.meta.dirname, `../../fixtures/${name}`);
  return readFile(filename);
}

async function geoJSONFromFixture(name) {
  const tile = new VectorTile(new Protobuf(await readPbf(`${name}.pbf`)));
  const vtf = tile.layers.geojson.feature(0);
  const f = new GeoJSONFeature(vtf, 0, 0, 0);
  return f.geometry;
}
