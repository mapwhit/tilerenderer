import { CollisionVertexArray } from '../array_types.js';
import SegmentVector from '../segment.js';
import { collisionVertexAttributes } from './symbol_attributes.js';

export default class CollisionBuffers {
  constructor(LayoutArray, layoutAttributes, IndexArray) {
    this.layoutVertexArray = new LayoutArray();
    this.layoutAttributes = layoutAttributes;
    this.indexArray = new IndexArray();
    this.segments = new SegmentVector();
    this.collisionVertexArray = new CollisionVertexArray();
  }

  upload(context) {
    this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, this.layoutAttributes);
    this.indexBuffer = context.createIndexBuffer(this.indexArray);
    this.collisionVertexBuffer = context.createVertexBuffer(
      this.collisionVertexArray,
      collisionVertexAttributes.members,
      true
    );
  }

  destroy() {
    if (!this.layoutVertexBuffer) {
      return;
    }
    this.layoutVertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.segments.destroy();
    this.collisionVertexBuffer.destroy();
  }
}
