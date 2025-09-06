import { dist, equals, Point } from '@mapwhit/point-geometry';
import { VectorTileFeature } from '@mapwhit/vector-tile';
import EvaluationParameters from '../../style/evaluation_parameters.js';
import { LineLayoutArray } from '../array_types.js';
import EXTENT from '../extent.js';
import { TriangleIndexArray } from '../index_array_type.js';
import loadGeometry from '../load_geometry.js';
import { ProgramConfigurationSet } from '../program_configuration.js';
import SegmentVector from '../segment.js';
import layout from './line_attributes.js';
import { addPatternDependencies, hasPattern } from './pattern_bucket_features.js';

const layoutAttributes = layout.members;
const vectorTileFeatureTypes = VectorTileFeature.types;

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
const EXTRUDE_SCALE = 63;

/*
 * Sharp corners cause dashed lines to tilt because the distance along the line
 * is the same at both the inner and outer corners. To improve the appearance of
 * dashed lines we add extra points near sharp corners so that a smaller part
 * of the line is tilted.
 *
 * COS_HALF_SHARP_CORNER controls how sharp a corner has to be for us to add an
 * extra vertex. The default is 75 degrees.
 *
 * The newly created vertices are placed SHARP_CORNER_OFFSET pixels from the corner.
 */
const COS_HALF_SHARP_CORNER = Math.cos((75 / 2) * (Math.PI / 180));
const SHARP_CORNER_OFFSET = 15;

// The number of bits that is used to store the line distance in the buffer.
const LINE_DISTANCE_BUFFER_BITS = 15;

// We don't have enough bits for the line distance as we'd like to have, so
// use this value to scale the line distance (in tile units) down to a smaller
// value. This lets us store longer distances while sacrificing precision.
const LINE_DISTANCE_SCALE = 1 / 2;

// The maximum line distance, in tile units, that fits in the buffer.
const MAX_LINE_DISTANCE = 2 ** (LINE_DISTANCE_BUFFER_BITS - 1) / LINE_DISTANCE_SCALE;

function addLineVertex(layoutVertexBuffer, point, extrude, round, up, dir, linesofar) {
  layoutVertexBuffer.emplaceBack(
    // a_pos_normal
    point.x,
    point.y,
    round ? 1 : 0,
    up ? 1 : -1,
    // a_data
    // add 128 to store a byte in an unsigned byte
    Math.round(EXTRUDE_SCALE * extrude.x) + 128,
    Math.round(EXTRUDE_SCALE * extrude.y) + 128,
    // Encode the -1/0/1 direction value into the first two bits of .z of a_data.
    // Combine it with the lower 6 bits of `linesofar` (shifted by 2 bites to make
    // room for the direction value). The upper 8 bits of `linesofar` are placed in
    // the `w` component. `linesofar` is scaled down by `LINE_DISTANCE_SCALE` so that
    // we can store longer distances while sacrificing precision.
    ((dir === 0 ? 0 : dir < 0 ? -1 : 1) + 1) | (((linesofar * LINE_DISTANCE_SCALE) & 0x3f) << 2),
    (linesofar * LINE_DISTANCE_SCALE) >> 6
  );
}

export default class LineBucket {
  constructor({ zoom, overscaling, layers, index }) {
    this.zoom = zoom;
    this.overscaling = overscaling;
    this.layers = layers;
    this.index = index;
    this.features = [];
    this.hasPattern = false;

    this.layoutVertexArray = new LineLayoutArray();
    this.indexArray = new TriangleIndexArray();
    this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, layers, zoom);
    this.segments = new SegmentVector();
  }

  populate(features, options) {
    this.features = [];
    this.hasPattern = hasPattern('line', this.layers, options);

    for (const { feature, index, sourceLayerIndex } of features) {
      if (!this.layers[0]._featureFilter(new EvaluationParameters(this.zoom), feature)) {
        continue;
      }

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
        this.features.push(addPatternDependencies('line', this.layers, patternFeature, { zoom: this.zoom }, options));
      } else {
        this.addFeature(patternFeature, geometry, index, {});
      }

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
    this.programConfigurations.destroy();
    this.segments.destroy();
  }

  addFeature(feature, geometry, index, imagePositions) {
    const layout = this.layers[0]._layout;
    const join = layout.get('line-join').evaluate(feature, {});
    const cap = layout.get('line-cap');
    const miterLimit = layout.get('line-miter-limit');
    const roundLimit = layout.get('line-round-limit');

    for (const line of geometry) {
      this.addLine(line, feature, join, cap, miterLimit, roundLimit, index, imagePositions);
    }
  }

  addLine(vertices, feature, join, cap, miterLimit, roundLimit, index, imagePositions) {
    const isPolygon = vectorTileFeatureTypes[feature.type] === 'Polygon';

    // If the line has duplicate vertices at the ends, adjust start/length to remove them.
    const firstVertex = Point.clone(vertices[0]);
    const lastVertex = Point.clone(vertices[vertices.length - 1]);
    let len = vertices.length;
    while (len >= 2 && lastVertex.equals(vertices[len - 2])) {
      len--;
    }
    let first = 0;
    while (first < len - 1 && firstVertex.equals(vertices[first + 1])) {
      first++;
    }

    // Ignore invalid geometry.
    if (len < (isPolygon ? 3 : 2)) {
      return;
    }

    let lineDistances = null;
    if (
      feature.properties?.hasOwnProperty('mapbox_clip_start') &&
      feature.properties?.hasOwnProperty('mapbox_clip_end')
    ) {
      lineDistances = {
        start: feature.properties.mapbox_clip_start,
        end: feature.properties.mapbox_clip_end,
        tileTotal: calculateFullDistance(vertices, first, len)
      };
    }

    if (join === 'bevel') {
      miterLimit = 1.05;
    }

    const sharpCornerOffset = SHARP_CORNER_OFFSET * (EXTENT / (512 * this.overscaling));

    // we could be more precise, but it would only save a negligible amount of space
    const segment = this.segments.prepareSegment(len * 10, this.layoutVertexArray, this.indexArray);

    this.distance = 0;

    const beginCap = cap;
    const endCap = isPolygon ? 'butt' : cap;
    let startOfLine = true;
    let currentVertex;
    let prevVertex;
    let prevNormal;
    let nextNormal;

    // the last three vertices added
    this.e1 = this.e2 = this.e3 = -1;

    if (isPolygon) {
      currentVertex = vertices[len - 2];
      nextNormal = firstVertex.sub(currentVertex)._unit()._perp();
    }

    for (let i = first; i < len; i++) {
      let nextVertex =
        isPolygon && i === len - 1
          ? vertices[first + 1]
          : // if the line is closed, we treat the last vertex like the first
            vertices[i + 1]; // just the next vertex

      // if two consecutive vertices exist, skip the current one
      if (nextVertex && equals(vertices[i], nextVertex)) {
        continue;
      }
      if (nextVertex) {
        nextVertex = Point.clone(nextVertex);
      }

      if (nextNormal) {
        prevNormal = nextNormal;
      }
      if (currentVertex) {
        prevVertex = currentVertex;
      }

      currentVertex = vertices[i];

      // Calculate the normal towards the next vertex in this line. In case
      // there is no next vertex, pretend that the line is continuing straight,
      // meaning that we are just using the previous normal.
      nextNormal = nextVertex ? nextVertex.sub(currentVertex)._unit()._perp() : prevNormal;

      // If we still don't have a previous normal, this is the beginning of a
      // non-closed line, so we're doing a straight "join".
      prevNormal = prevNormal || nextNormal;

      // Determine the normal of the join extrusion. It is the angle bisector
      // of the segments between the previous line and the next line.
      // In the case of 180° angles, the prev and next normals cancel each other out:
      // prevNormal + nextNormal = (0, 0), its magnitude is 0, so the unit vector would be
      // undefined. In that case, we're keeping the joinNormal at (0, 0), so that the cosHalfAngle
      // below will also become 0 and miterLength will become Infinity.
      let joinNormal = prevNormal.add(nextNormal);
      if (joinNormal.x !== 0 || joinNormal.y !== 0) {
        joinNormal._unit();
      }
      /*  joinNormal     prevNormal
       *             ↖      ↑
       *                .________. prevVertex
       *                |
       * nextNormal  ←  |  currentVertex
       *                |
       *     nextVertex !
       *
       */

      // Calculate the length of the miter (the ratio of the miter to the width).
      // Find the cosine of the angle between the next and join normals
      // using dot product. The inverse of that is the miter length.
      const cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;
      const miterLength = cosHalfAngle !== 0 ? 1 / cosHalfAngle : Number.POSITIVE_INFINITY;

      const isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;

      if (isSharpCorner && i > first) {
        const prevSegmentLength = dist(currentVertex, prevVertex);
        if (prevSegmentLength > 2 * sharpCornerOffset) {
          const newPrevVertex = Point.clone(currentVertex)._sub(
            Point.clone(currentVertex)
              ._sub(prevVertex)
              ._mult(sharpCornerOffset / prevSegmentLength)
              ._round()
          );
          this.distance += dist(newPrevVertex, prevVertex);
          this.addCurrentVertex(newPrevVertex, this.distance, prevNormal.mult(1), 0, 0, false, segment, lineDistances);
          prevVertex = newPrevVertex;
        }
      }

      // The join if a middle vertex, otherwise the cap.
      const middleVertex = prevVertex && nextVertex;
      let currentJoin = middleVertex ? join : nextVertex ? beginCap : endCap;

      if (middleVertex && currentJoin === 'round') {
        if (miterLength < roundLimit) {
          currentJoin = 'miter';
        } else if (miterLength <= 2) {
          currentJoin = 'fakeround';
        }
      }

      if (currentJoin === 'miter' && miterLength > miterLimit) {
        currentJoin = 'bevel';
      }

      if (currentJoin === 'bevel') {
        // The maximum extrude length is 128 / 63 = 2 times the width of the line
        // so if miterLength >= 2 we need to draw a different type of bevel here.
        if (miterLength > 2) {
          currentJoin = 'flipbevel';
        }

        // If the miterLength is really small and the line bevel wouldn't be visible,
        // just draw a miter join to save a triangle.
        if (miterLength < miterLimit) {
          currentJoin = 'miter';
        }
      }

      // Calculate how far along the line the currentVertex is
      if (prevVertex) {
        this.distance += dist(currentVertex, prevVertex);
      }

      switch (currentJoin) {
        case 'miter':
          joinNormal._mult(miterLength);
          this.addCurrentVertex(currentVertex, this.distance, joinNormal, 0, 0, false, segment, lineDistances);
          break;

        case 'flipbevel':
          // miter is too big, flip the direction to make a beveled join

          if (miterLength > 100) {
            // Almost parallel lines
            joinNormal = nextNormal.mult(-1);
          } else {
            const direction = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0 ? -1 : 1;
            const bevelLength = (miterLength * prevNormal.add(nextNormal).mag()) / prevNormal.sub(nextNormal).mag();
            joinNormal._perp()._mult(bevelLength * direction);
          }
          this.addCurrentVertex(currentVertex, this.distance, joinNormal, 0, 0, false, segment, lineDistances);
          this.addCurrentVertex(currentVertex, this.distance, joinNormal.mult(-1), 0, 0, false, segment, lineDistances);
          break;

        case 'bevel':
        case 'fakeround': {
          const lineTurnsLeft = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0;
          const offset = -Math.sqrt(miterLength * miterLength - 1);
          let offsetA;
          let offsetB;

          if (lineTurnsLeft) {
            offsetB = 0;
            offsetA = offset;
          } else {
            offsetA = 0;
            offsetB = offset;
          }

          // Close previous segment with a bevel
          if (!startOfLine) {
            this.addCurrentVertex(
              currentVertex,
              this.distance,
              prevNormal,
              offsetA,
              offsetB,
              false,
              segment,
              lineDistances
            );
          }

          if (currentJoin === 'fakeround') {
            // The join angle is sharp enough that a round join would be visible.
            // Bevel joins fill the gap between segments with a single pie slice triangle.
            // Create a round join by adding multiple pie slices. The join isn't actually round, but
            // it looks like it is at the sizes we render lines at.

            // Add more triangles for sharper angles.
            // This math is just a good enough approximation. It isn't "correct".
            const n = Math.floor((0.5 - (cosHalfAngle - 0.5)) * 8);
            let approxFractionalJoinNormal;

            for (let m = 0; m < n; m++) {
              approxFractionalJoinNormal = nextNormal
                .mult((m + 1) / (n + 1))
                ._add(prevNormal)
                ._unit();
              this.addPieSliceVertex(
                currentVertex,
                this.distance,
                approxFractionalJoinNormal,
                lineTurnsLeft,
                segment,
                lineDistances
              );
            }

            this.addPieSliceVertex(currentVertex, this.distance, joinNormal, lineTurnsLeft, segment, lineDistances);

            for (let k = n - 1; k >= 0; k--) {
              approxFractionalJoinNormal = prevNormal
                .mult((k + 1) / (n + 1))
                ._add(nextNormal)
                ._unit();
              this.addPieSliceVertex(
                currentVertex,
                this.distance,
                approxFractionalJoinNormal,
                lineTurnsLeft,
                segment,
                lineDistances
              );
            }
          }

          // Start next segment
          if (nextVertex) {
            this.addCurrentVertex(
              currentVertex,
              this.distance,
              nextNormal,
              -offsetA,
              -offsetB,
              false,
              segment,
              lineDistances
            );
          }
          break;
        }

        case 'butt':
          if (!startOfLine) {
            // Close previous segment with a butt
            this.addCurrentVertex(currentVertex, this.distance, prevNormal, 0, 0, false, segment, lineDistances);
          }

          // Start next segment with a butt
          if (nextVertex) {
            this.addCurrentVertex(currentVertex, this.distance, nextNormal, 0, 0, false, segment, lineDistances);
          }
          break;

        case 'square':
          if (!startOfLine) {
            // Close previous segment with a square cap
            this.addCurrentVertex(currentVertex, this.distance, prevNormal, 1, 1, false, segment, lineDistances);

            // The segment is done. Unset vertices to disconnect segments.
            this.e1 = this.e2 = -1;
          }

          // Start next segment
          if (nextVertex) {
            this.addCurrentVertex(currentVertex, this.distance, nextNormal, -1, -1, false, segment, lineDistances);
          }
          break;

        case 'round':
          if (!startOfLine) {
            // Close previous segment with butt
            this.addCurrentVertex(currentVertex, this.distance, prevNormal, 0, 0, false, segment, lineDistances);

            // Add round cap or linejoin at end of segment
            this.addCurrentVertex(currentVertex, this.distance, prevNormal, 1, 1, true, segment, lineDistances);

            // The segment is done. Unset vertices to disconnect segments.
            this.e1 = this.e2 = -1;
          }

          // Start next segment with a butt
          if (nextVertex) {
            // Add round cap before first segment
            this.addCurrentVertex(currentVertex, this.distance, nextNormal, -1, -1, true, segment, lineDistances);

            this.addCurrentVertex(currentVertex, this.distance, nextNormal, 0, 0, false, segment, lineDistances);
          }
          break;
      }

      if (isSharpCorner && i < len - 1) {
        const nextSegmentLength = dist(currentVertex, nextVertex);
        if (nextSegmentLength > 2 * sharpCornerOffset) {
          const newCurrentVertex = Point.clone(currentVertex)._add(
            Point.clone(nextVertex)
              ._sub(currentVertex)
              ._mult(sharpCornerOffset / nextSegmentLength)
              ._round()
          );
          this.distance += dist(newCurrentVertex, currentVertex);
          this.addCurrentVertex(
            newCurrentVertex,
            this.distance,
            nextNormal.mult(1),
            0,
            0,
            false,
            segment,
            lineDistances
          );
          currentVertex = newCurrentVertex;
        }
      }

      startOfLine = false;
    }

    this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {
      imagePositions
    });
  }

  /**
   * Add two vertices to the buffers.
   *
   * @param {Object} currentVertex the line vertex to add buffer vertices for
   * @param {number} distance the distance from the beginning of the line to the vertex
   * @param {number} endLeft extrude to shift the left vertex along the line
   * @param {number} endRight extrude to shift the left vertex along the line
   * @param {boolean} round whether this is a round cap
   * @private
   */
  addCurrentVertex(currentVertex, distance, normal, endLeft, endRight, round, segment, distancesForScaling) {
    let extrude;
    const layoutVertexArray = this.layoutVertexArray;
    const indexArray = this.indexArray;

    if (distancesForScaling) {
      // For gradient lines, scale distance from tile units to [0, 2^15)
      distance = scaleDistance(distance, distancesForScaling);
    }

    extrude = Point.clone(normal);
    if (endLeft) {
      extrude._sub(normal.perp()._mult(endLeft));
    }
    addLineVertex(layoutVertexArray, currentVertex, extrude, round, false, endLeft, distance);
    this.e3 = segment.vertexLength++;
    if (this.e1 >= 0 && this.e2 >= 0) {
      indexArray.emplaceBack(this.e1, this.e2, this.e3);
      segment.primitiveLength++;
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    extrude = normal.mult(-1);
    if (endRight) {
      extrude._sub(normal.perp()._mult(endRight));
    }
    addLineVertex(layoutVertexArray, currentVertex, extrude, round, true, -endRight, distance);
    this.e3 = segment.vertexLength++;
    if (this.e1 >= 0 && this.e2 >= 0) {
      indexArray.emplaceBack(this.e1, this.e2, this.e3);
      segment.primitiveLength++;
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    // There is a maximum "distance along the line" that we can store in the buffers.
    // When we get close to the distance, reset it to zero and add the vertex again with
    // a distance of zero. The max distance is determined by the number of bits we allocate
    // to `linesofar`.
    if (distance > MAX_LINE_DISTANCE / 2 && !distancesForScaling) {
      this.distance = 0;
      this.addCurrentVertex(currentVertex, this.distance, normal, endLeft, endRight, round, segment);
    }
  }

  /**
   * Add a single new vertex and a triangle using two previous vertices.
   * This adds a pie slice triangle near a join to simulate round joins
   *
   * @param currentVertex the line vertex to add buffer vertices for
   * @param distance the distance from the beginning of the line to the vertex
   * @param extrude the offset of the new vertex from the currentVertex
   * @param lineTurnsLeft whether the line is turning left or right at this angle
   * @private
   */
  addPieSliceVertex(currentVertex, distance, extrude, lineTurnsLeft, segment, distancesForScaling) {
    extrude = extrude.mult(lineTurnsLeft ? -1 : 1);
    const layoutVertexArray = this.layoutVertexArray;
    const indexArray = this.indexArray;

    if (distancesForScaling) {
      distance = scaleDistance(distance, distancesForScaling);
    }

    addLineVertex(layoutVertexArray, currentVertex, extrude, false, lineTurnsLeft, 0, distance);
    this.e3 = segment.vertexLength++;
    if (this.e1 >= 0 && this.e2 >= 0) {
      indexArray.emplaceBack(this.e1, this.e2, this.e3);
      segment.primitiveLength++;
    }

    if (lineTurnsLeft) {
      this.e2 = this.e3;
    } else {
      this.e1 = this.e3;
    }
  }
}

/**
 * Knowing the ratio of the full linestring covered by this tiled feature, as well
 * as the total distance (in tile units) of this tiled feature, and the distance
 * (in tile units) of the current vertex, we can determine the relative distance
 * of this vertex along the full linestring feature and scale it to [0, 2^15)
 *
 * @param {number} tileDistance the distance from the beginning of the tiled line to this vertex
 * @param {Object} stats
 * @param {number} stats.start the ratio (0-1) along a full original linestring feature of the start of this tiled line feature
 * @param {number} stats.end the ratio (0-1) along a full original linestring feature of the end of this tiled line feature
 * @param {number} stats.tileTotal the total distance, in tile units, of this tiled line feature
 *
 * @private
 */
function scaleDistance(tileDistance, stats) {
  return ((tileDistance / stats.tileTotal) * (stats.end - stats.start) + stats.start) * (MAX_LINE_DISTANCE - 1);
}

/**
 * Calculate the total distance, in tile units, of this tiled line feature
 *
 * @param {Array<Point>} vertices the full geometry of this tiled line feature
 * @param {number} first the index in the vertices array representing the first vertex we should consider
 * @param {number} len the count of vertices we should consider from `first`
 *
 * @private
 */
function calculateFullDistance(vertices, first, len) {
  let total = 0;
  let prev = vertices[first];
  for (let i = first + 1; i < len; i++) {
    const next = vertices[i];
    total += dist(prev, next);
    prev = next;
  }
  return total;
}
