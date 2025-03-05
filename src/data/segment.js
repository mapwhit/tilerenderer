const warn = require('../util/warn');

const { register } = require('../util/transfer_registry');

class SegmentVector {
  constructor(segments = []) {
    this.segments = segments;
  }

  prepareSegment(numVertices, layoutVertexArray, indexArray) {
    let segment = this.segments[this.segments.length - 1];
    if (numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH)
      warn.once(
        `Max vertices per segment is ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH}: bucket requested ${numVertices}`
      );
    if (!segment || segment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
      segment = {
        vertexOffset: layoutVertexArray.length,
        primitiveOffset: indexArray.length,
        vertexLength: 0,
        primitiveLength: 0
      };
      this.segments.push(segment);
    }
    return segment;
  }

  get() {
    return this.segments;
  }

  destroy() {
    for (const segment of this.segments) {
      for (const k in segment.vaos) {
        segment.vaos[k].destroy();
      }
    }
  }

  static simpleSegment(vertexOffset, primitiveOffset, vertexLength, primitiveLength) {
    return new SegmentVector([
      {
        vertexOffset: vertexOffset,
        primitiveOffset: primitiveOffset,
        vertexLength: vertexLength,
        primitiveLength: primitiveLength,
        vaos: {}
      }
    ]);
  }
}

/*
 * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
 * addressing of vertex buffers.
 * @private
 * @readonly
 */
SegmentVector.MAX_VERTEX_ARRAY_LENGTH = 2 ** 16 - 1;

register('SegmentVector', SegmentVector);

module.exports = SegmentVector;
