import assert from 'assert';
import earcut from 'earcut';
import EvaluationParameters from '../../style/evaluation_parameters.js';
import classifyRings from '../../util/classify_rings.js';
import { FillLayoutArray } from '../array_types.js';
import { LineIndexArray, TriangleIndexArray } from '../index_array_type.js';
import loadGeometry from '../load_geometry.js';
import { ProgramConfigurationSet } from '../program_configuration.js';
import SegmentVector from '../segment.js';
import layout from './fill_attributes.js';
import { addPatternDependencies, hasPattern } from './pattern_bucket_features.js';

const EARCUT_MAX_RINGS = 500;
const layoutAttributes = layout.members;

class FillBucket {
  constructor(options) {
    this.zoom = options.zoom;
    this.overscaling = options.overscaling;
    this.layers = options.layers;
    this.index = options.index;
    this.hasPattern = false;
    this.features = [];

    this.layoutVertexArray = new FillLayoutArray();
    this.indexArray = new TriangleIndexArray();
    this.indexArray2 = new LineIndexArray();
    this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);
    this.segments = new SegmentVector();
    this.segments2 = new SegmentVector();
    this.stateDependentLayerIds = this.layers.filter(l => l.isStateDependent()).map(l => l.id);
  }

  populate(features, options) {
    this.hasPattern = hasPattern('fill', this.layers, options);
    const fillSortKey = this.layers[0]._layout.get('fill-sort-key');
    const bucketFeatures = [];

    for (const { feature, index, sourceLayerIndex } of features) {
      if (!this.layers[0]._featureFilter(new EvaluationParameters(this.zoom), feature)) {
        continue;
      }

      const geometry = loadGeometry(feature);
      const sortKey = fillSortKey ? fillSortKey.evaluate(feature, {}) : undefined;

      const bucketFeature = {
        id: feature.id,
        properties: feature.properties,
        type: feature.type,
        sourceLayerIndex,
        index,
        geometry,
        patterns: {},
        sortKey
      };

      bucketFeatures.push(bucketFeature);
    }

    if (fillSortKey) {
      bucketFeatures.sort((a, b) => {
        // a.sortKey is always a number when in use
        return a.sortKey - b.sortKey;
      });
    }

    for (const bucketFeature of bucketFeatures) {
      const { geometry, index, sourceLayerIndex } = bucketFeature;

      if (this.hasPattern) {
        const patternFeature = addPatternDependencies('fill', this.layers, bucketFeature, { zoom: this.zoom }, options);
        // pattern features are added only once the pattern is loaded into the image atlas
        // so are stored during populate until later updated with positions by tile worker in addFeatures
        this.features.push(patternFeature);
      } else {
        this.addFeature(bucketFeature, geometry, index, {});
      }

      const feature = features[index].feature;
      options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
    }
  }

  update(states, vtLayer, imagePositions) {
    if (!this.stateDependentLayers.length) {
      return;
    }
    this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, {
      imagePositions
    });
  }

  addFeatures(options, imagePositions) {
    for (const feature of this.features) {
      this.addFeature(feature, feature.geometry, feature.index, imagePositions);
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
    if (!this.layoutVertexBuffer) {
      return;
    }
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

        const { x, y } = ring[0];
        this.layoutVertexArray.emplaceBack(x, y);
        this.indexArray2.emplaceBack(lineIndex + ring.length - 1, lineIndex);
        flattened.push(x, y);

        for (let i = 1; i < ring.length; i++) {
          const { x, y } = ring[i];
          this.layoutVertexArray.emplaceBack(x, y);
          this.indexArray2.emplaceBack(lineIndex + i - 1, lineIndex + i);
          flattened.push(x, y);
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

    this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {
      imagePositions
    });
  }
}

export default FillBucket;
