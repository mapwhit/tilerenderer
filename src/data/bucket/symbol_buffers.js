import {
  PlacedSymbolArray,
  StructArrayLayout3f12 as SymbolDynamicLayoutArray,
  StructArrayLayout4i4ui16 as SymbolLayoutArray,
  StructArrayLayout1ul4 as SymbolOpacityArray,
  StructArrayLayout3ui6 as TriangleIndexArray
} from '../array_types.js';
import SegmentVector from '../segment.js';
import { dynamicLayoutAttributes, symbolLayoutAttributes } from './symbol_attributes.js';

// Opacity arrays are frequently updated but don't contain a lot of information, so we pack them
// tight. Each Uint32 is actually four duplicate Uint8s for the four corners of a glyph
// 7 bits are for the current opacity, and the lowest bit is the target opacity

// actually defined in symbol_attributes.js
// const placementOpacityAttributes = [
//     { name: 'a_fade_opacity', components: 1, type: 'Uint32' }
// ];
const shaderOpacityAttributes = [{ name: 'a_fade_opacity', components: 1, type: 'Uint8', offset: 0 }];

export default class SymbolBuffers {
  constructor(programConfigurations) {
    this.layoutVertexArray = new SymbolLayoutArray();
    this.indexArray = new TriangleIndexArray();
    this.programConfigurations = programConfigurations;
    this.segments = new SegmentVector();
    this.dynamicLayoutVertexArray = new SymbolDynamicLayoutArray();
    this.opacityVertexArray = new SymbolOpacityArray();
    this.placedSymbolArray = new PlacedSymbolArray();
  }

  upload(context, dynamicIndexBuffer, upload, update) {
    if (upload) {
      this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, symbolLayoutAttributes.members);
      this.indexBuffer = context.createIndexBuffer(this.indexArray, dynamicIndexBuffer);
      this.dynamicLayoutVertexBuffer = context.createVertexBuffer(
        this.dynamicLayoutVertexArray,
        dynamicLayoutAttributes.members,
        true
      );
      this.opacityVertexBuffer = context.createVertexBuffer(this.opacityVertexArray, shaderOpacityAttributes, true);
      // This is a performance hack so that we can write to opacityVertexArray with uint32s
      // even though the shaders read uint8s
      this.opacityVertexBuffer.itemSize = 1;
    }
    if (upload || update) {
      this.programConfigurations.upload(context);
    }
  }

  destroy() {
    if (!this.layoutVertexBuffer) {
      return;
    }
    this.layoutVertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.programConfigurations.destroy();
    this.segments.destroy();
    this.dynamicLayoutVertexBuffer.destroy();
    this.opacityVertexBuffer.destroy();
  }
}
