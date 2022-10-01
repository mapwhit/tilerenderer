import test from 'node:test';
import { applySourceDiff, isUpdateableGeoJSON, toUpdateable } from '../../../src/source/geojson_source_diff.js';

test('isUpdateableGeoJSON', async t => {
  await t.test('feature without id is not updateable', t => {
    // no feature id -> false
    t.assert.equal(
      isUpdateableGeoJSON({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        },
        properties: {}
      }),
      false
    );
  });

  await t.test('feature with id is updateable', t => {
    // has a feature id -> true
    t.assert.equal(
      isUpdateableGeoJSON({
        type: 'Feature',
        id: 'feature_id',
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        },
        properties: {}
      }),
      true
    );
  });

  await t.test('promoteId missing is not updateable', t => {
    t.assert.equal(
      isUpdateableGeoJSON(
        {
          type: 'Feature',
          id: 'feature_id',
          geometry: {
            type: 'Point',
            coordinates: [0, 0]
          },
          properties: {}
        },
        'propId'
      ),
      false
    );
  });

  await t.test('promoteId present is updateable', t => {
    t.assert.equal(
      isUpdateableGeoJSON(
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [0, 0]
          },
          properties: {
            propId: 'feature_id'
          }
        },
        'propId'
      ),
      true
    );
  });

  await t.test('feature collection with unique ids is updateable', t => {
    t.assert.equal(
      isUpdateableGeoJSON({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'feature_id',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {}
          },
          {
            type: 'Feature',
            id: 'feature_id_2',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {}
          }
        ]
      }),
      true
    );
  });

  await t.test('feature collection with unique promoteIds is updateable', t => {
    t.assert.equal(
      isUpdateableGeoJSON(
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [0, 0]
              },
              properties: {
                propId: 'feature_id'
              }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [0, 0]
              },
              properties: {
                propId: 'feature_id_2'
              }
            }
          ]
        },
        'propId'
      ),
      true
    );
  });

  await t.test('feature collection without unique ids is not updateable', t => {
    t.assert.equal(
      isUpdateableGeoJSON({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {}
          }
        ]
      }),
      false
    );
  });

  await t.test('feature collection with duplicate feature ids is not updateable', t => {
    t.assert.equal(
      isUpdateableGeoJSON({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'feature_id',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {}
          },
          {
            type: 'Feature',
            id: 'feature_id',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {}
          }
        ]
      }),
      false
    );
  });

  await t.test('geometries are not updateable', t => {
    t.assert.equal(isUpdateableGeoJSON({ type: 'Point', coordinates: [0, 0] }), false);
  });
});

test('toUpdateable', async t => {
  await t.test('works with a single feature - feature id', t => {
    const updateable = toUpdateable({
      type: 'Feature',
      id: 'point',
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      },
      properties: {}
    });
    t.assert.equal(updateable.size, 1);
    t.assert.equal(updateable.has('point'), true);
  });

  await t.test('works with a single feature - promoteId', t => {
    const updateable2 = toUpdateable(
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0]
        },
        properties: {
          promoteId: 'point'
        }
      },
      'promoteId'
    );
    t.assert.equal(updateable2.size, 1);
    t.assert.equal(updateable2.has('point'), true);
  });

  await t.test('works with a FeatureCollection - feature id', t => {
    const updateable = toUpdateable({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'point',
          geometry: {
            type: 'Point',
            coordinates: [0, 0]
          },
          properties: {}
        },
        {
          type: 'Feature',
          id: 'point2',
          geometry: {
            type: 'Point',
            coordinates: [0, 0]
          },
          properties: {}
        }
      ]
    });
    t.assert.equal(updateable.size, 2);
    t.assert.equal(updateable.has('point'), true);
    t.assert.equal(updateable.has('point2'), true);
  });

  await t.test('works with a FeatureCollection - promoteId', t => {
    const updateable2 = toUpdateable(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {
              promoteId: 'point'
            }
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [0, 0]
            },
            properties: {
              promoteId: 'point2'
            }
          }
        ]
      },
      'promoteId'
    );
    t.assert.equal(updateable2.size, 2);
    t.assert.equal(updateable2.has('point'), true);
    t.assert.equal(updateable2.has('point2'), true);
  });
});

test('applySourceDiff', async t => {
  const point = {
    type: 'Feature',
    id: 'point',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    },
    properties: {}
  };
  const point2 = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [0, 0]
    },
    properties: {
      promoteId: 'point2'
    }
  };
  // freeze our input data to guarantee that applySourceDiff works immutably
  Object.freeze(point);
  Object.freeze(point.geometry);
  Object.freeze(point.geometry.coordinates);
  Object.freeze(point.properties);
  Object.freeze(point2);
  Object.freeze(point2.geometry);
  Object.freeze(point2.geometry.coordinates);
  Object.freeze(point2.properties);

  await t.test('adds a feature using the feature id', t => {
    const updateable = new Map();
    applySourceDiff(updateable, {
      add: [point]
    });
    t.assert.equal(updateable.size, 1);
    t.assert.equal(updateable.has('point'), true);
  });

  await t.test('adds a feature using the promoteId', t => {
    const updateable = new Map();
    applySourceDiff(
      updateable,
      {
        add: [point2]
      },
      'promoteId'
    );
    t.assert.equal(updateable.size, 1);
    t.assert.equal(updateable.has('point2'), true);
  });

  await t.test('removes a feature by its id', t => {
    const updateable = new Map([
      ['point', point],
      ['point2', point2]
    ]);
    applySourceDiff(updateable, {
      remove: ['point2']
    });
    t.assert.equal(updateable.size, 1);
    t.assert.equal(updateable.has('point2'), false);
  });

  await t.test('updates a feature geometry', t => {
    const updateable = new Map([['point', point]]);
    // update -> new geometry
    applySourceDiff(updateable, {
      update: [
        {
          id: 'point',
          newGeometry: {
            type: 'Point',
            coordinates: [1, 0]
          }
        }
      ]
    });
    t.assert.equal(updateable.size, 1);
    t.assert.equal(updateable.get('point')?.geometry.coordinates[0], 1);
  });

  await t.test('adds properties', t => {
    const updateable = new Map([['point', point]]);
    applySourceDiff(updateable, {
      update: [
        {
          id: 'point',
          addOrUpdateProperties: [
            { key: 'prop', value: 'value' },
            { key: 'prop2', value: 'value2' }
          ]
        }
      ]
    });
    t.assert.equal(updateable.size, 1);
    const properties = updateable.get('point')?.properties;
    t.assert.equal(Object.keys(properties).length, 2);
    t.assert.equal(properties.prop, 'value');
    t.assert.equal(properties.prop2, 'value2');
  });

  await t.test('updates properties', t => {
    const updateable = new Map([['point', { ...point, properties: { prop: 'value', prop2: 'value2' } }]]);
    applySourceDiff(updateable, {
      update: [
        {
          id: 'point',
          addOrUpdateProperties: [{ key: 'prop2', value: 'value3' }]
        }
      ]
    });
    t.assert.equal(updateable.size, 1);
    const properties2 = updateable.get('point')?.properties;
    t.assert.equal(Object.keys(properties2).length, 2);
    t.assert.equal(properties2.prop, 'value');
    t.assert.equal(properties2.prop2, 'value3');
  });

  await t.test('removes properties', t => {
    const updateable = new Map([['point', { ...point, properties: { prop: 'value', prop2: 'value2' } }]]);
    applySourceDiff(updateable, {
      update: [
        {
          id: 'point',
          removeProperties: ['prop2']
        }
      ]
    });
    t.assert.equal(updateable.size, 1);
    const properties3 = updateable.get('point')?.properties;
    t.assert.equal(Object.keys(properties3).length, 1);
    t.assert.equal(properties3.prop, 'value');
  });

  await t.test('removes all properties', t => {
    const updateable = new Map([['point', { ...point, properties: { prop: 'value', prop2: 'value2' } }]]);
    applySourceDiff(updateable, {
      update: [
        {
          id: 'point',
          removeAllProperties: true
        }
      ]
    });
    t.assert.equal(updateable.size, 1);
    t.assert.equal(Object.keys(updateable.get('point')?.properties).length, 0);
  });
});
