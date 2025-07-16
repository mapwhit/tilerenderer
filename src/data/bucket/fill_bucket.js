const { FillLayoutArray } = require('../array_types');

const { members: layoutAttributes } = require('./fill_attributes');
const SegmentVector = require('../segment');
const { ProgramConfigurationSet } = require('../program_configuration');
const { LineIndexArray, TriangleIndexArray } = require('../index_array_type');
const { default: earcut } = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;
const { register } = require('../../util/transfer_registry');
const { hasPattern, addPatternDependencies } = require('./pattern_bucket_features');
const loadGeometry = require('../load_geometry');
const EvaluationParameters = require('../../style/evaluation_parameters');

class FillBucket {
  constructor(options) {
    this.zoom = options.zoom;
    this.overscaling = options.overscaling;
    this.layers = options.layers;
    this.layerIds = this.layers.map(layer => layer.id);
    this.index = options.index;
    this.hasPattern = false;

    this.layoutVertexArray = new FillLayoutArray();
    this.indexArray = new TriangleIndexArray();
    this.indexArray2 = new LineIndexArray();
    this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);
    this.segments = new SegmentVector();
    this.segments2 = new SegmentVector();
  }

  populate(features, options) {
    this.features = [];
    this.hasPattern = hasPattern('fill', this.layers, options);

    for (const { feature, index, sourceLayerIndex } of features) {
      if (!this.layers[0]._featureFilter(new EvaluationParameters(this.zoom), feature)) continue;

      const geometry = loadGeometry(feature);

      const patternFeature = {
        sourceLayerIndex,
        index,
        geometry,
        properties: feature.properties,
        type: feature.type,
        patterns: {}
      };

      if (typeof feature.id !== 'undefined') {
        patternFeature.id = feature.id;
      }

      if (this.hasPattern) {
        this.features.push(addPatternDependencies('fill', this.layers, patternFeature, this.zoom, options));
      } else {
        this.addFeature(patternFeature, geometry, index, {});
      }

      options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
    }
  }

  update(states, vtLayer, imagePositions) {
    if (!this.stateDependentLayers.length) return;
    this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
  }

  addFeatures(options, imagePositions) {
    for (const feature of this.features) {
      const { geometry } = feature;
      this.addFeature(feature, geometry, feature.index, imagePositions);
    }
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
      this.indexBuffer2 = context.createIndexBuffer(this.indexArray2);
    }
    this.programConfigurations.upload(context);
    this.uploaded = true;
  }

  destroy() {
    if (!this.layoutVertexBuffer) return;
    this.layoutVertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.indexBuffer2.destroy();
    this.programConfigurations.destroy();
    this.segments.destroy();
    this.segments2.destroy();
  }

  addFeature(feature, geometry, index, imagePositions) {
    for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
      let numVertices = 0;
      for (const ring of polygon) {
        numVertices += ring.length;
      }

      const triangleSegment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
      const triangleIndex = triangleSegment.vertexLength;

      const flattened = [];
      const holeIndices = [];

      for (const ring of polygon) {
        if (ring.length === 0) {
          continue;
        }

        if (ring !== polygon[0]) {
          holeIndices.push(flattened.length / 2);
        }

        const lineSegment = this.segments2.prepareSegment(ring.length, this.layoutVertexArray, this.indexArray2);
        const lineIndex = lineSegment.vertexLength;

        this.layoutVertexArray.emplaceBack(ring[0].x, ring[0].y);
        this.indexArray2.emplaceBack(lineIndex + ring.length - 1, lineIndex);
        flattened.push(ring[0].x);
        flattened.push(ring[0].y);

        for (let i = 1; i < ring.length; i++) {
          this.layoutVertexArray.emplaceBack(ring[i].x, ring[i].y);
          this.indexArray2.emplaceBack(lineIndex + i - 1, lineIndex + i);
          flattened.push(ring[i].x);
          flattened.push(ring[i].y);
        }

        lineSegment.vertexLength += ring.length;
        lineSegment.primitiveLength += ring.length;
      }

      const indices = earcut(flattened, holeIndices);
      assert(indices.length % 3 === 0);

      for (let i = 0; i < indices.length; i += 3) {
        this.indexArray.emplaceBack(
          triangleIndex + indices[i],
          triangleIndex + indices[i + 1],
          triangleIndex + indices[i + 2]
        );
      }

      triangleSegment.vertexLength += numVertices;
      triangleSegment.primitiveLength += indices.length / 3;
    }

    this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions);
  }
}

register('FillBucket', FillBucket, { omit: ['layers', 'features'] });

module.exports = FillBucket;
