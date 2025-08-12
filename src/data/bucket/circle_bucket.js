const { CircleLayoutArray } = require('../array_types');

const { members: layoutAttributes } = require('./circle_attributes');
const SegmentVector = require('../segment');
const { ProgramConfigurationSet } = require('../program_configuration');
const { TriangleIndexArray } = require('../index_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const EvaluationParameters = require('../../style/evaluation_parameters');

function addCircleVertex(layoutVertexArray, x, y, extrudeX, extrudeY) {
  layoutVertexArray.emplaceBack(x * 2 + (extrudeX + 1) / 2, y * 2 + (extrudeY + 1) / 2);
}

/**
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 * @private
 */
class CircleBucket {
  constructor(options) {
    this.zoom = options.zoom;
    this.globalState = options.globalState;
    this.overscaling = options.overscaling;
    this.layers = options.layers;
    this.layerIds = this.layers.map(layer => layer.id);
    this.index = options.index;
    this.hasPattern = false;

    this.layoutVertexArray = new CircleLayoutArray();
    this.indexArray = new TriangleIndexArray();
    this.segments = new SegmentVector();
    this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);
  }

  populate(features, options) {
    for (const { feature, index, sourceLayerIndex } of features) {
      if (
        this.layers[0]._featureFilter(new EvaluationParameters(this.zoom, { globalState: this.globalState }), feature)
      ) {
        const geometry = loadGeometry(feature);
        this.addFeature(feature, geometry, index);
        options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
      }
    }
  }

  update(states, vtLayer, imagePositions) {
    if (!this.stateDependentLayers.length) return;
    this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
      imagePositions,
      globalState: this.globalState
    });
  }

  isEmpty() {
    return this.layoutVertexArray.length === 0;
  }

  uploadPending() {
    return !this.uploaded || this.programConfigurations.needsUpload;
  }

  upload(context) {
    if (!this.uploaded) {
      this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
      this.indexBuffer = context.createIndexBuffer(this.indexArray);
    }
    this.programConfigurations.upload(context);
    this.uploaded = true;
  }

  destroy() {
    if (!this.layoutVertexBuffer) return;
    this.layoutVertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.programConfigurations.destroy();
    this.segments.destroy();
  }

  addFeature(feature, geometry, index) {
    for (const ring of geometry) {
      for (const point of ring) {
        const x = point.x;
        const y = point.y;

        // Do not include points that are outside the tile boundaries.
        if (x < 0 || x >= EXTENT || y < 0 || y >= EXTENT) continue;

        // this geometry will be of the Point type, and we'll derive
        // two triangles from it.
        //
        // ┌─────────┐
        // │ 3     2 │
        // │         │
        // │ 0     1 │
        // └─────────┘

        const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
        const index = segment.vertexLength;

        addCircleVertex(this.layoutVertexArray, x, y, -1, -1);
        addCircleVertex(this.layoutVertexArray, x, y, 1, -1);
        addCircleVertex(this.layoutVertexArray, x, y, 1, 1);
        addCircleVertex(this.layoutVertexArray, x, y, -1, 1);

        this.indexArray.emplaceBack(index, index + 1, index + 2);
        this.indexArray.emplaceBack(index, index + 3, index + 2);

        segment.vertexLength += 4;
        segment.primitiveLength += 2;
      }
    }

    this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {
      imagePositions: {},
      globalState: this.globalState
    });
  }
}

module.exports = CircleBucket;
