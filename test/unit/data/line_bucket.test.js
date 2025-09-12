import test from 'node:test';
import LineBucket from '../../../src/data/bucket/line_bucket.js';
import segment from '../../../src/data/segment.js';
import LineStyleLayer from '../../../src/style/style_layer/line_style_layer.js';
import { createPopulateOptions, getFeaturesFromLayer, loadVectorTile } from '../../util/tile.js';

function createLine(numPoints) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    points.push({ x: i / numPoints, y: i / numPoints });
  }
  return points;
}

function createLineBucket({ id, layout, paint, globalState, overscaling = 1 }) {
  const layer = new LineStyleLayer(
    {
      id,
      type: 'line',
      layout,
      paint
    },
    globalState
  );
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  // Create and return a new LineBucket
  return new LineBucket({ layers: [layer], overscaling });
}

test('LineBucket', async t => {
  let sourceLayer;
  t.before(() => {
    // Load line features from fixture tile.
    sourceLayer = loadVectorTile().layers.road;
  });

  await t.test('LineBucket', t => {
    t.assert.doesNotThrow(() => {
      const bucket = createLineBucket({ id: 'test' });

      const line = {
        type: 2,
        properties: {}
      };

      const polygon = {
        type: 3,
        properties: {}
      };

      bucket.addLine([{ x: 0, y: 0 }], line);

      bucket.addLine([{ x: 0, y: 0 }], polygon);

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ],
        line
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ],
        polygon
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 0 }
        ],
        line
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 0 }
        ],
        polygon
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 20 }
        ],
        line
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 20 }
        ],
        polygon
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 20 },
          { x: 0, y: 0 }
        ],
        line
      );

      bucket.addLine(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 20 },
          { x: 0, y: 0 }
        ],
        polygon
      );

      const feature = sourceLayer.feature(0);
      bucket.addFeature(feature, feature.loadGeometry());
    });
  });

  await t.test('LineBucket segmentation', t => {
    // Stub MAX_VERTEX_ARRAY_LENGTH so we can test features
    // breaking across array groups without tests taking a _long_ time.
    let _MAX_VERTEX_ARRAY_LENGTH;
    t.before(() => {
      _MAX_VERTEX_ARRAY_LENGTH = segment.MAX_GLYPHS;
      segment.MAX_VERTEX_ARRAY_LENGTH = 256;
    });
    t.after(() => {
      segment.MAX_VERTEX_ARRAY_LENGTH = _MAX_VERTEX_ARRAY_LENGTH;
    });

    const warn = t.mock.method(console, 'warn');

    const bucket = createLineBucket({ id: 'test' });

    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature({}, [createLine(10)]);

    // add a feature that will break across the group boundary
    bucket.addFeature({}, [createLine(128)]);

    // Each polygon must fit entirely within a segment, so we expect the
    // first segment to include the first feature and the first polygon
    // of the second feature, and the second segment to include the
    // second polygon of the second feature.
    t.assert.equal(bucket.layoutVertexArray.length, 276);
    t.assert.deepEqual(bucket.segments.get(), [
      {
        vertexOffset: 0,
        vertexLength: 20,
        primitiveOffset: 0,
        primitiveLength: 18
      },
      {
        vertexOffset: 20,
        vertexLength: 256,
        primitiveOffset: 18,
        primitiveLength: 254
      }
    ]);

    t.assert.equal(warn.mock.callCount(), 1);
  });

  await t.test('LineBucket line-pattern with global-state', t => {
    const bucket = createLineBucket({
      id: 'test',
      paint: { 'line-pattern': ['coalesce', ['get', 'pattern'], ['global-state', 'pattern']] },
      globalState: { pattern: 'test-pattern' }
    });

    bucket.populate(getFeaturesFromLayer(sourceLayer), createPopulateOptions());

    t.assert.ok(bucket.features.length > 0);
    t.assert.deepEqual(bucket.features[0].patterns, {
      test: { min: 'test-pattern', mid: 'test-pattern', max: 'test-pattern' }
    });
  });

  await t.test('isEmpty method', t => {
    const bucket = createLineBucket({ id: 'test' });

    // Should be empty initially
    t.assert.equal(bucket.isEmpty(), true);

    // Use addFeature to properly populate the bucket
    const line = {
      type: 2,
      properties: {}
    };

    bucket.addFeature(line, [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    ]);

    // Should no longer be empty
    t.assert.equal(bucket.isEmpty(), false);
  });

  await t.test('uploadPending method', t => {
    const bucket = createLineBucket({ id: 'test' });

    // Should need upload initially when uploaded is undefined/false
    t.assert.equal(bucket.uploadPending(), true);

    // Set uploaded flag to true
    bucket.uploaded = true;

    // Set programConfigurations.needsUpload to true
    bucket.programConfigurations.needsUpload = true;

    // Should still need upload because programConfigurations.needsUpload is true
    t.assert.equal(bucket.uploadPending(), true);

    // Set programConfigurations.needsUpload to false
    bucket.programConfigurations.needsUpload = false;

    // Now it should not need upload
    t.assert.equal(bucket.uploadPending(), false);
  });

  await t.test('destroy method', t => {
    const bucket = createLineBucket({ id: 'test' });

    // No layoutVertexBuffer - should return without error
    t.assert.doesNotThrow(() => bucket.destroy());

    // Mock methods for destroy testing
    bucket.layoutVertexBuffer = {
      destroy: t.mock.fn()
    };
    bucket.indexBuffer = {
      destroy: t.mock.fn()
    };
    bucket.programConfigurations.destroy = t.mock.fn();
    bucket.segments.destroy = t.mock.fn();

    // Test destroy
    bucket.destroy();

    // Check that destroy was called for layoutVertexBuffer
    t.assert.equal(bucket.layoutVertexBuffer.destroy.mock.callCount(), 1);
  });

  await t.test('upload method', t => {
    const bucket = createLineBucket({ id: 'test' });

    // Add some data to make it non-empty
    const line = {
      type: 2,
      properties: {}
    };
    bucket.addFeature(line, [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ]
    ]);

    // Create mock context
    const mockContext = {
      createVertexBuffer: t.mock.fn(() => ({ destroy: () => {} })),
      createIndexBuffer: t.mock.fn(() => ({ destroy: () => {} }))
    };

    // Mock programConfigurations.upload
    bucket.programConfigurations.upload = t.mock.fn();

    // Test upload when not yet uploaded
    bucket.upload(mockContext);

    // Verify correct calls were made
    t.assert.equal(mockContext.createVertexBuffer.mock.callCount(), 1);
    t.assert.equal(mockContext.createIndexBuffer.mock.callCount(), 1);
    t.assert.equal(bucket.programConfigurations.upload.mock.callCount(), 1);
    t.assert.equal(bucket.uploaded, true);

    // Reset mocks
    mockContext.createVertexBuffer.mock.resetCalls();
    mockContext.createIndexBuffer.mock.resetCalls();
    bucket.programConfigurations.upload.mock.resetCalls();

    // Test upload when already uploaded
    bucket.upload(mockContext);

    // Should not create buffers again
    t.assert.equal(mockContext.createVertexBuffer.mock.callCount(), 0);
    t.assert.equal(mockContext.createIndexBuffer.mock.callCount(), 0);
    t.assert.equal(bucket.programConfigurations.upload.mock.callCount(), 1);
  });

  await t.test('addLine with different join types', t => {
    // Test each join type
    const joinTypes = ['miter', 'bevel', 'round'];
    const capTypes = ['butt', 'round', 'square'];

    for (const join of joinTypes) {
      for (const cap of capTypes) {
        const bucket = createLineBucket({
          id: 'test',
          layout: {
            'line-join': join,
            'line-cap': cap,
            'line-miter-limit': 2,
            'line-round-limit': 1.05
          }
        });

        const line = {
          type: 2,
          properties: {}
        };

        // Create a line with sharp angle to test all join types
        const points = [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 20 },
          { x: 10, y: 30 }
        ];

        t.assert.doesNotThrow(() => {
          bucket.addLine(points, line, join, cap, 2, 1.05, 0, {});
        }, `Should not throw with join=${join}, cap=${cap}`);

        // Verify we have vertices
        t.assert.ok(bucket.layoutVertexArray.length > 0, `Should have vertices with join=${join}, cap=${cap}`);
      }
    }
  });

  await t.test('addLine with miter exceeding miterLimit', t => {
    const bucket = createLineBucket({
      id: 'test',
      layout: {
        'line-join': 'miter',
        'line-cap': 'butt',
        'line-miter-limit': 1.5, // Set low to force exceeding the limit
        'line-round-limit': 1.05
      }
    });

    const line = {
      type: 2,
      properties: {}
    };

    // Create a line with very sharp angle to exceed miter limit
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10.1 } // Creates a very sharp angle
    ];

    t.assert.doesNotThrow(() => {
      bucket.addLine(points, line, 'miter', 'butt', 1.5, 1.05, 0, {});
    });
  });

  await t.test('addLine with lineDistances', t => {
    const bucket = createLineBucket({ id: 'test' });

    const line = {
      type: 2,
      properties: {
        mapbox_clip_start: 0.25,
        mapbox_clip_end: 0.75
      }
    };

    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 }
    ];

    t.assert.doesNotThrow(() => {
      bucket.addLine(points, line, 'miter', 'butt', 2, 1.05, 0, {});
    });
  });

  await t.test('update method', t => {
    // Create two separate buckets for the two test cases
    const bucketWithLayers = createLineBucket({ id: 'test' });
    const bucketWithoutLayers = createLineBucket({ id: 'test' });

    // Setup stateDependentLayers for the first bucket
    bucketWithLayers.stateDependentLayers = ['test-layer'];

    // Setup empty stateDependentLayers for the second bucket
    bucketWithoutLayers.stateDependentLayers = [];

    // Mock updatePaintArrays for both buckets
    bucketWithLayers.programConfigurations.updatePaintArrays = t.mock.fn(() => {});
    bucketWithoutLayers.programConfigurations.updatePaintArrays = t.mock.fn(() => {});

    const mockStates = { test: 'state' };
    const mockVtLayer = { test: 'layer' };
    const mockImagePositions = { test: 'image' };

    // Test update with stateDependentLayers
    bucketWithLayers.update(mockStates, mockVtLayer, mockImagePositions);

    // Verify updatePaintArrays was called
    t.assert.equal(bucketWithLayers.programConfigurations.updatePaintArrays.mock.callCount(), 1);

    // Test update with empty stateDependentLayers
    bucketWithoutLayers.update(mockStates, mockVtLayer, mockImagePositions);

    // Should not call updatePaintArrays with empty stateDependentLayers
    t.assert.equal(bucketWithoutLayers.programConfigurations.updatePaintArrays.mock.callCount(), 0);
  });

  await t.test('addFeatures method', t => {
    const bucket = createLineBucket({ id: 'test' });

    // Create mock features
    const mockFeatures = [
      {
        geometry: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 10 }
          ]
        ],
        index: 0
      },
      {
        geometry: [
          [
            { x: 20, y: 20 },
            { x: 30, y: 30 }
          ]
        ],
        index: 1
      }
    ];

    // Set up the features array
    bucket.features = mockFeatures;

    // Mock addFeature
    bucket.addFeature = t.mock.fn(() => {});

    const mockImagePositions = { test: 'image' };

    // Test addFeatures
    bucket.addFeatures({}, mockImagePositions);

    // Should call addFeature for each feature
    t.assert.equal(bucket.addFeature.mock.callCount(), 2);
  });

  await t.test('addLine with maxed-out distance', t => {
    const bucket = createLineBucket({ id: 'test' });

    // Create a very long line to test distance reset logic
    const line = {
      type: 2,
      properties: {}
    };

    // Create a long line with many points far apart to exceed MAX_LINE_DISTANCE/2
    const points = [];
    for (let i = 0; i < 1000; i++) {
      // Points far apart to ensure distance grows quickly
      points.push({ x: i * 100, y: i * 100 });
    }

    // Spy on addCurrentVertex
    const addCurrentVertexSpy = t.mock.method(bucket, 'addCurrentVertex');

    // Call addLine with the long line
    bucket.addLine(points, line, 'miter', 'butt', 2, 1.05, 0, {});

    // Check if addCurrentVertex was called with reset distance
    let foundResetCall = false;
    for (let i = 1; i < addCurrentVertexSpy.mock.callCount(); i++) {
      // If the distance is 0 in a subsequent call, we've reset due to exceeding MAX_LINE_DISTANCE/2
      if (addCurrentVertexSpy.mock.calls[i].arguments[1] === 0) {
        foundResetCall = true;
        break;
      }
    }
    t.assert.ok(foundResetCall, 'Distance should have been reset due to exceeding MAX_LINE_DISTANCE/2');
  });

  await t.test('addLine with polygon feature type', t => {
    const bucket = createLineBucket({ id: 'test' });

    // Create a polygon feature (type 3)
    const polygon = {
      type: 3, // Polygon type
      properties: {}
    };

    // Points that form a simple polygon
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 } // Closing point
    ];

    // Spy on methods to check special polygon handling
    bucket.addCurrentVertex = t.mock.fn(bucket.addCurrentVertex.bind(bucket));

    // Call addLine with the polygon
    bucket.addLine(points, polygon, 'miter', 'butt', 2, 1.05, 0, {});

    // Verify vertices were added
    t.assert.ok(bucket.addCurrentVertex.mock.callCount() > 0);
    t.assert.ok(bucket.layoutVertexArray.length > 0);
  });

  await t.test('addLine with overscaling impact on sharpCornerOffset', t => {
    // Create a bucket with high overscaling
    const bucket = createLineBucket({ id: 'test', overscaling: 8 });

    const line = {
      type: 2,
      properties: {}
    };

    // Create a sharp corner with a very specific angle to ensure different behavior
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 101 } // Creates a very sharp turn
    ];

    // Call addLine
    bucket.addLine(points, line, 'miter', 'butt', 2, 1.05, 0, {});
    const countWithHighOverscaling = bucket.layoutVertexArray.length;

    // Create a bucket with very different overscaling for comparison
    const bucket2 = createLineBucket({ id: 'test', overscaling: 1 });

    // Call addLine with the same parameters
    bucket2.addLine(points, line, 'miter', 'butt', 2, 1.05, 0, {});
    const countWithLowOverscaling = bucket2.layoutVertexArray.length;

    // Verify that we have vertices in both cases
    t.assert.ok(countWithHighOverscaling > 0);
    t.assert.ok(countWithLowOverscaling > 0);

    // Now we check that the logic executed differently by checking internal properties
    // which is a proxy for different behavior based on overscaling
    t.assert.ok(
      bucket.distance !== bucket2.distance ||
        bucket.segments.get()[0].primitiveLength !== bucket2.segments.get()[0].primitiveLength,
      'Different overscaling should affect vertex generation'
    );
  });
});
