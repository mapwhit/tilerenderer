import test from 'node:test';
import { VectorTileFeature } from '@mapwhit/vector-tile';
import {
  default as FillExtrusionBucket,
  isBoundaryEdge,
  isEntirelyOutside
} from '../../../src/data/bucket/fill_extrusion_bucket.js';
import EXTENT from '../../../src/data/extent.js';
import { FillExtrusionStyleLayer } from '../../../src/style/style_layer/fill_extrusion_style_layer.js';
import { createPopulateOptions, getFeaturesFromLayer, loadVectorTile } from '../../util/tile.js';

function createFillExtrusionBucket({ id, layout, paint, globalState, zoom = 0, overscaling = 1, index = 0 }) {
  const layer = new FillExtrusionStyleLayer(
    {
      id,
      type: 'fill-extrusion',
      layout,
      paint
    },
    globalState
  );
  layer.recalculate({ zoom, zoomHistory: {} });

  return new FillExtrusionBucket({ layers: [layer], zoom, overscaling, index });
}

test('FillExtrusionBucket', async t => {
  let sourceLayer;
  t.before(() => {
    // Load fill extrusion features from fixture tile.
    sourceLayer = loadVectorTile().layers.water;
  });

  await t.test('FillExtrusionBucket fill-pattern with global-state', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-extrusion-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] },
      globalState: { pattern: 'test-pattern' }
    });

    bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions());

    t.assert.ok(bucket.features.length > 0);
    t.assert.deepEqual(bucket.features[0].patterns, {
      test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
    });
  });

  await t.test('FillExtrusionBucket without pattern', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-extrusion-height': 10 },
      globalState: {}
    });

    const options = createPopulateOptions();

    // Use t.mock.method to track addFeature calls
    t.mock.method(bucket, 'addFeature');

    bucket.populate(getFeaturesFromLayer(sourceLayer), options);

    t.assert.equal(bucket.hasPattern, false);
    t.assert.equal(bucket.features.length, 0); // Features are processed directly
    t.assert.ok(bucket.addFeature.mock.callCount() > 0, 'addFeature should be called for each feature');
  });

  await t.test('FillExtrusionBucket with feature id', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-extrusion-pattern': ['get', 'pattern'] },
      globalState: {}
    });

    // Create a mock feature with ID that matches what loadGeometry expects
    const mockFeature = {
      feature: {
        id: 123,
        properties: {},
        type: VectorTileFeature.types.Polygon,
        loadGeometry: () => [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ]
        ]
      },
      index: 0,
      sourceLayerIndex: 0
    };

    // Use t.mock.method to override feature filter
    t.mock.method(bucket.layers[0], '_featureFilter', () => true);

    bucket.populate([mockFeature], createPopulateOptions());

    t.assert.ok(bucket.features.length > 0);
    t.assert.equal(bucket.features[0].id, 123);
  });

  await t.test('FillExtrusionBucket#isEmpty', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    t.assert.equal(bucket.isEmpty(), true, 'Empty bucket should return true');

    // Add a vertex to make it non-empty
    bucket.layoutVertexArray.emplaceBack(0, 0, 0, 0, 0, 0);

    t.assert.equal(bucket.isEmpty(), false, 'Non-empty bucket should return false');
  });

  await t.test('FillExtrusionBucket#uploadPending', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    t.assert.equal(bucket.uploadPending(), true, 'New bucket should have pending uploads');

    // Mock the upload
    bucket.uploaded = true;
    bucket.programConfigurations.needsUpload = false;

    t.assert.equal(bucket.uploadPending(), false, 'Uploaded bucket should not have pending uploads');

    // Test with programConfigurations needing upload
    bucket.programConfigurations.needsUpload = true;

    t.assert.equal(
      bucket.uploadPending(),
      true,
      'Bucket should have pending uploads when programConfigurations needs upload'
    );
  });

  await t.test('FillExtrusionBucket#upload', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    // Create mock functions for context methods
    const mockCreateVertexBuffer = t.mock.fn(() => ({ destroy: t.mock.fn() }));
    const mockCreateIndexBuffer = t.mock.fn(() => ({ destroy: t.mock.fn() }));

    const context = {
      createVertexBuffer: mockCreateVertexBuffer,
      createIndexBuffer: mockCreateIndexBuffer
    };

    // Use t.mock.method to track programConfigurations.upload
    t.mock.method(bucket.programConfigurations, 'upload');

    bucket.upload(context);

    t.assert.equal(mockCreateVertexBuffer.mock.callCount(), 1);
    t.assert.equal(mockCreateIndexBuffer.mock.callCount(), 1);
    t.assert.equal(bucket.programConfigurations.upload.mock.callCount(), 1);
    t.assert.equal(bucket.uploaded, true);

    // Test upload when already uploaded
    bucket.upload(context);

    t.assert.equal(mockCreateVertexBuffer.mock.callCount(), 1); // Should not increase
    t.assert.equal(mockCreateIndexBuffer.mock.callCount(), 1); // Should not increase
    t.assert.equal(bucket.programConfigurations.upload.mock.callCount(), 2); // Should increase
  });

  await t.test('FillExtrusionBucket#destroy', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    // Create mock destroy functions
    const mockLayoutBufferDestroy = t.mock.fn();
    const mockIndexBufferDestroy = t.mock.fn();

    bucket.layoutVertexBuffer = { destroy: mockLayoutBufferDestroy };
    bucket.indexBuffer = { destroy: mockIndexBufferDestroy };

    // Use t.mock.method to track destroy calls
    t.mock.method(bucket.programConfigurations, 'destroy');
    t.mock.method(bucket.segments, 'destroy');

    bucket.destroy();

    t.assert.equal(mockLayoutBufferDestroy.mock.callCount(), 1);
    t.assert.equal(mockIndexBufferDestroy.mock.callCount(), 1);
    t.assert.equal(bucket.programConfigurations.destroy.mock.callCount(), 1);
    t.assert.equal(bucket.segments.destroy.mock.callCount(), 1);

    // Test destroy when no buffers exist
    bucket.layoutVertexBuffer = null;

    // Reset mock call counts by creating new mocks
    bucket.programConfigurations.destroy = t.mock.fn();
    bucket.segments.destroy = t.mock.fn();

    // This should not throw and should not call any destroy methods
    bucket.destroy();

    t.assert.equal(bucket.programConfigurations.destroy.mock.callCount(), 0);
    t.assert.equal(bucket.segments.destroy.mock.callCount(), 0);
  });

  await t.test('FillExtrusionBucket#addFeatures', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: { 'fill-extrusion-pattern': ['get', 'pattern'] }
    });

    // Add mock features to bucket
    bucket.features = [
      {
        geometry: [
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 }
          ]
        ],
        index: 0
      },
      {
        geometry: [
          [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 2, y: 2 }
          ]
        ],
        index: 1
      }
    ];

    // Use t.mock.method to track addFeature calls
    t.mock.method(bucket, 'addFeature');

    // Mock image positions
    const imagePositions = { pattern: {} };

    bucket.addFeatures({}, imagePositions);

    t.assert.equal(bucket.addFeature.mock.callCount(), 2);
  });

  await t.test('FillExtrusionBucket#update with no state dependent layers', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    // Initialize stateDependentLayers as an empty array
    bucket.stateDependentLayers = [];

    // Use t.mock.method to track updatePaintArrays calls
    t.mock.method(bucket.programConfigurations, 'updatePaintArrays');

    bucket.update({}, {}, {});

    t.assert.equal(bucket.programConfigurations.updatePaintArrays.mock.callCount(), 0);
  });

  await t.test('FillExtrusionBucket#update with state dependent layers', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    // Initialize stateDependentLayers with a mock layer
    bucket.stateDependentLayers = [{}];

    // Use t.mock.method to track updatePaintArrays calls with a proper implementation
    t.mock.method(bucket.programConfigurations, 'updatePaintArrays', () => {});

    const states = {};
    const vtLayer = {};
    const imagePositions = {};

    bucket.update(states, vtLayer, imagePositions);

    t.assert.equal(bucket.programConfigurations.updatePaintArrays.mock.callCount(), 1);

    const callArgs = bucket.programConfigurations.updatePaintArrays.mock.calls[0].arguments;
    t.assert.deepEqual(callArgs[0], states);
    t.assert.deepEqual(callArgs[1], vtLayer);
    t.assert.deepEqual(callArgs[2], bucket.stateDependentLayers);
    t.assert.deepEqual(callArgs[3].imagePositions, imagePositions);
    t.assert.deepEqual(callArgs[3].globalState, bucket.globalState);
  });

  await t.test('FillExtrusionBucket feature filtering', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    // Use t.mock.method to override feature filter
    t.mock.method(bucket.layers[0], '_featureFilter', (params, feature) => feature.properties.pass === true);

    // Create options with mock featureIndex
    const options = createPopulateOptions();
    t.mock.method(options.featureIndex, 'insert');

    // Create features with loadGeometry method
    const features = [
      {
        feature: {
          properties: { pass: false },
          loadGeometry: () => []
        },
        index: 0,
        sourceLayerIndex: 0
      },
      {
        feature: {
          properties: { pass: true },
          loadGeometry: () => [
            [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 }
            ]
          ]
        },
        index: 1,
        sourceLayerIndex: 0
      }
    ];

    t.mock.method(bucket, 'addFeature');

    bucket.populate(features, options);

    // The first feature should be filtered out
    t.assert.equal(bucket.addFeature.mock.callCount(), 1);
    t.assert.equal(options.featureIndex.insert.mock.callCount(), 1);

    // Check that we're adding the right feature
    t.assert.equal(bucket.addFeature.mock.calls[0].arguments[0].properties.pass, true);
  });

  await t.test('FillExtrusionBucket non-polygon features', t => {
    const bucket = createFillExtrusionBucket({
      id: 'test',
      layout: {},
      paint: {}
    });

    // Create a LineString feature
    const lineStringFeature = {
      type: VectorTileFeature.types.LineString,
      geometry: [
        [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ]
      ],
      properties: {}
    };

    // Initial state of arrays
    const initialVertexLength = bucket.layoutVertexArray.length;

    // Process the LineString feature
    bucket.addFeature(lineStringFeature, lineStringFeature.geometry, 0, {});

    // Check vertex array has changed (for edges) but no triangulation happened
    // We can't test this perfectly without understanding the implementation details
    // but we can check that the algorithm is doing something with the edges but
    // not triangulating
    t.assert.notEqual(
      bucket.layoutVertexArray.length,
      initialVertexLength,
      'Vertex array should change for LineString edges'
    );
  });
});

test('isBoundaryEdge function', t => {
  // Create points for testing boundary edges
  const p1OutsideX = { x: -1, y: 5 };
  const p2OutsideX = { x: -1, y: 6 }; // Same x as p1OutsideX
  const p1OutsideY = { x: 5, y: -1 };
  const p2OutsideY = { x: 6, y: -1 }; // Same y as p1OutsideY
  const p1Inside = { x: 10, y: 10 };
  const p2Inside = { x: 20, y: 20 };
  const p1OverX = { x: EXTENT + 10, y: 5 };
  const p2OverX = { x: EXTENT + 10, y: 6 }; // Same x as p1OverX
  const p1OverY = { x: 5, y: EXTENT + 10 };
  const p2OverY = { x: 6, y: EXTENT + 10 }; // Same y as p1OverY

  // Test boundary edge detection
  t.assert.equal(isBoundaryEdge(p1OutsideX, p2OutsideX), true, 'Outside X boundary');
  t.assert.equal(isBoundaryEdge(p1OutsideY, p2OutsideY), true, 'Outside Y boundary');
  t.assert.equal(isBoundaryEdge(p1Inside, p2Inside), false, 'Inside boundary');
  t.assert.equal(isBoundaryEdge(p1OverX, p2OverX), true, 'Over X boundary');
  t.assert.equal(isBoundaryEdge(p1OverY, p2OverY), true, 'Over Y boundary');
});

test('isEntirelyOutside function', t => {
  // Test rings that are entirely outside
  const outsideRingLeft = [
    { x: -10, y: 10 },
    { x: -20, y: 10 },
    { x: -20, y: 20 },
    { x: -10, y: 20 }
  ];

  const outsideRingRight = [
    { x: EXTENT + 10, y: 10 },
    { x: EXTENT + 20, y: 10 },
    { x: EXTENT + 20, y: 20 },
    { x: EXTENT + 10, y: 20 }
  ];

  const outsideRingTop = [
    { x: 10, y: -10 },
    { x: 20, y: -10 },
    { x: 20, y: -20 },
    { x: 10, y: -20 }
  ];

  const outsideRingBottom = [
    { x: 10, y: EXTENT + 10 },
    { x: 20, y: EXTENT + 10 },
    { x: 20, y: EXTENT + 20 },
    { x: 10, y: EXTENT + 20 }
  ];

  const insideRing = [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 }
  ];

  const partiallyOutsideRing = [
    { x: -10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: -10, y: 20 }
  ];

  t.assert.equal(isEntirelyOutside(outsideRingLeft), true, 'Ring entirely to the left should be outside');
  t.assert.equal(isEntirelyOutside(outsideRingRight), true, 'Ring entirely to the right should be outside');
  t.assert.equal(isEntirelyOutside(outsideRingTop), true, 'Ring entirely to the top should be outside');
  t.assert.equal(isEntirelyOutside(outsideRingBottom), true, 'Ring entirely to the bottom should be outside');
  t.assert.equal(isEntirelyOutside(insideRing), false, 'Ring inside should not be outside');
  t.assert.equal(
    isEntirelyOutside(partiallyOutsideRing),
    false,
    'Partially outside ring should not be considered entirely outside'
  );
});
