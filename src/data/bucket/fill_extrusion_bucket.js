const { FillExtrusionLayoutArray } = require('../array_types');

const { members: layoutAttributes } = require('./fill_extrusion_attributes');
const SegmentVector = require('../segment');
const { ProgramConfigurationSet } = require('../program_configuration');
const { TriangleIndexArray } = require('../index_array_type');
const EXTENT = require('../extent');
const { default: earcut } = require('earcut');
const {
  VectorTileFeature: { types: vectorTileFeatureTypes }
} = require('@mapwhit/vector-tile');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;
const { register } = require('../../util/transfer_registry');
const { hasPattern, addPatternDependencies } = require('./pattern_bucket_features');
const loadGeometry = require('../load_geometry');
const EvaluationParameters = require('../../style/evaluation_parameters');

const FACTOR = 2 ** 13;

function addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
  vertexArray.emplaceBack(
    // a_pos
    x,
    y,
    // a_normal_ed: 3-component normal and 1-component edgedistance
    Math.floor(nx * FACTOR) * 2 + t,
    ny * FACTOR * 2,
    nz * FACTOR * 2,
    // edgedistance (used for wrapping patterns around extrusion sides)
    Math.round(e)
  );
}

class FillExtrusionBucket {
  constructor(options) {
    this.zoom = options.zoom;
    this.globalState = options.globalState;
    this.overscaling = options.overscaling;
    this.layers = options.layers;
    this.layerIds = this.layers.map(layer => layer.id);
    this.index = options.index;
    this.hasPattern = false;

    this.layoutVertexArray = new FillExtrusionLayoutArray();
    this.indexArray = new TriangleIndexArray();
    this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);
    this.segments = new SegmentVector();
  }

  populate(features, options) {
    this.features = [];
    this.hasPattern = hasPattern('fill-extrusion', this.layers, options);

    for (const { feature, index, sourceLayerIndex } of features) {
      if (
        !this.layers[0]._featureFilter(new EvaluationParameters(this.zoom, { globalState: this.globalState }), feature)
      )
        continue;

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
        this.features.push(addPatternDependencies('fill-extrusion', this.layers, patternFeature, this.zoom, options));
      } else {
        this.addFeature(patternFeature, geometry, index, {});
      }

      options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index, true);
    }
  }

  addFeatures(options, imagePositions) {
    for (const feature of this.features) {
      const { geometry } = feature;
      this.addFeature(feature, geometry, feature.index, imagePositions);
    }
  }

  update(states, vtLayer, imagePositions) {
    if (!this.stateDependentLayers.length) return;
    this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
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

  addFeature(feature, geometry, index, imagePositions) {
    for (const polygon of classifyRings(geometry, EARCUT_MAX_RINGS)) {
      let numVertices = 0;
      for (const ring of polygon) {
        numVertices += ring.length;
      }
      let segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);

      for (const ring of polygon) {
        if (ring.length === 0) {
          continue;
        }

        if (isEntirelyOutside(ring)) {
          continue;
        }

        let edgeDistance = 0;

        for (let p = 0; p < ring.length; p++) {
          const p1 = ring[p];

          if (p >= 1) {
            const p2 = ring[p - 1];

            if (!isBoundaryEdge(p1, p2)) {
              if (segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
              }

              const perp = p1.sub(p2)._perp()._unit();
              const dist = p2.dist(p1);
              if (edgeDistance + dist > 32768) edgeDistance = 0;

              addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
              addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);

              edgeDistance += dist;

              addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
              addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);

              const bottomRight = segment.vertexLength;

              // ┌──────┐
              // │ 0  1 │ Counter-clockwise winding order.
              // │      │ Triangle 1: 0 => 2 => 1
              // │ 2  3 │ Triangle 2: 1 => 2 => 3
              // └──────┘
              this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
              this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

              segment.vertexLength += 4;
              segment.primitiveLength += 2;
            }
          }
        }
      }

      if (segment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
        segment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
      }

      //Only triangulate and draw the area of the feature if it is a polygon
      //Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
      if (vectorTileFeatureTypes[feature.type] !== 'Polygon') {
        continue;
      }

      const flattened = [];
      const holeIndices = [];
      const triangleIndex = segment.vertexLength;

      for (const ring of polygon) {
        if (ring.length === 0) {
          continue;
        }

        if (ring !== polygon[0]) {
          holeIndices.push(flattened.length / 2);
        }

        for (let i = 0; i < ring.length; i++) {
          const p = ring[i];

          addVertex(this.layoutVertexArray, p.x, p.y, 0, 0, 1, 1, 0);

          flattened.push(p.x);
          flattened.push(p.y);
        }
      }

      const indices = earcut(flattened, holeIndices);
      assert(indices.length % 3 === 0);

      for (let j = 0; j < indices.length; j += 3) {
        // Counter-clockwise winding order.
        this.indexArray.emplaceBack(
          triangleIndex + indices[j],
          triangleIndex + indices[j + 2],
          triangleIndex + indices[j + 1]
        );
      }

      segment.primitiveLength += indices.length / 3;
      segment.vertexLength += numVertices;
    }

    this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions);
  }
}

register('FillExtrusionBucket', FillExtrusionBucket, { omit: ['layers', 'features'] });

module.exports = FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
  return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) || (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}

function isEntirelyOutside(ring) {
  return (
    ring.every(p => p.x < 0) ||
    ring.every(p => p.x > EXTENT) ||
    ring.every(p => p.y < 0) ||
    ring.every(p => p.y > EXTENT)
  );
}
