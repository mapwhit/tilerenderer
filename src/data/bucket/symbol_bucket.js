const {
  symbolLayoutAttributes,
  collisionVertexAttributes,
  collisionBoxLayout,
  collisionCircleLayout,
  dynamicLayoutAttributes
} = require('./symbol_attributes');

const {
  SymbolLayoutArray,
  SymbolDynamicLayoutArray,
  SymbolOpacityArray,
  CollisionBoxLayoutArray,
  CollisionCircleLayoutArray,
  CollisionVertexArray,
  PlacedSymbolArray,
  SymbolInstanceArray,
  GlyphOffsetArray,
  SymbolLineVertexArray
} = require('../array_types');
const { default: Point } = require('@mapbox/point-geometry');
const SegmentVector = require('../segment');
const { ProgramConfigurationSet } = require('../program_configuration');
const { TriangleIndexArray, LineIndexArray } = require('../index_array_type');
const transformText = require('../../symbol/transform_text');
const mergeLines = require('../../symbol/mergelines');
const { allowsVerticalWritingMode } = require('../../util/script_detection');
const loadGeometry = require('../load_geometry');
const mvt = require('@mapwhit/vector-tile');
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
const { verticalizedCharacterMap } = require('../../util/verticalize_punctuation');
const { getSizeData } = require('../../symbol/symbol_size');
const { register } = require('../../util/transfer_registry');
const EvaluationParameters = require('../../style/evaluation_parameters');
const { Formatted } = require('@mapwhit/style-expressions');

// Opacity arrays are frequently updated but don't contain a lot of information, so we pack them
// tight. Each Uint32 is actually four duplicate Uint8s for the four corners of a glyph
// 7 bits are for the current opacity, and the lowest bit is the target opacity

// actually defined in symbol_attributes.js
// const placementOpacityAttributes = [
//     { name: 'a_fade_opacity', components: 1, type: 'Uint32' }
// ];
const shaderOpacityAttributes = [{ name: 'a_fade_opacity', components: 1, type: 'Uint8', offset: 0 }];

function addVertex(array, anchorX, anchorY, ox, oy, tx, ty, sizeVertex) {
  array.emplaceBack(
    // a_pos_offset
    anchorX,
    anchorY,
    Math.round(ox * 32),
    Math.round(oy * 32),

    // a_data
    tx, // x coordinate of symbol on glyph atlas texture
    ty, // y coordinate of symbol on glyph atlas texture
    sizeVertex ? sizeVertex[0] : 0,
    sizeVertex ? sizeVertex[1] : 0
  );
}

function addDynamicAttributes(dynamicLayoutVertexArray, p, angle) {
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}

class SymbolBuffers {
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
    if (!this.layoutVertexBuffer) return;
    this.layoutVertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.programConfigurations.destroy();
    this.segments.destroy();
    this.dynamicLayoutVertexBuffer.destroy();
    this.opacityVertexBuffer.destroy();
  }
}

register('SymbolBuffers', SymbolBuffers);

class CollisionBuffers {
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
    if (!this.layoutVertexBuffer) return;
    this.layoutVertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.segments.destroy();
    this.collisionVertexBuffer.destroy();
  }
}

register('CollisionBuffers', CollisionBuffers);

/**
 * Unlike other buckets, which simply implement #addFeature with type-specific
 * logic for (essentially) triangulating feature geometries, SymbolBucket
 * requires specialized behavior:
 *
 * 1. WorkerTile#parse(), the logical owner of the bucket creation process,
 *    calls SymbolBucket#populate(), which resolves text and icon tokens on
 *    each feature, adds each glyphs and symbols needed to the passed-in
 *    collections options.glyphDependencies and options.iconDependencies, and
 *    stores the feature data for use in subsequent step (this.features).
 *
 * 2. WorkerTile asynchronously requests from the main thread all of the glyphs
 *    and icons needed (by this bucket and any others). When glyphs and icons
 *    have been received, the WorkerTile creates a CollisionIndex and invokes:
 *
 * 3. performSymbolLayout(bucket, stacks, icons) perform texts shaping and
 *    layout on a Symbol Bucket. This step populates:
 *      `this.symbolInstances`: metadata on generated symbols
 *      `this.collisionBoxArray`: collision data for use by foreground
 *      `this.text`: SymbolBuffers for text symbols
 *      `this.icons`: SymbolBuffers for icons
 *      `this.collisionBox`: Debug SymbolBuffers for collision boxes
 *      `this.collisionCircle`: Debug SymbolBuffers for collision circles
 *    The results are sent to the foreground for rendering
 *
 * 4. performSymbolPlacement(bucket, collisionIndex) is run on the foreground,
 *    and uses the CollisionIndex along with current camera settings to determine
 *    which symbols can actually show on the map. Collided symbols are hidden
 *    using a dynamic "OpacityVertexArray".
 *
 * @private
 */
class SymbolBucket {
  constructor(options) {
    this.collisionBoxArray = options.collisionBoxArray;
    this.zoom = options.zoom;
    this.globalState = options.globalState;
    this.overscaling = options.overscaling;
    this.layers = options.layers;
    this.layerIds = this.layers.map(layer => layer.id);
    this.index = options.index;
    this.pixelRatio = options.pixelRatio;
    this.sourceLayerIndex = options.sourceLayerIndex;
    this.hasPattern = false;

    const layer = this.layers[0];
    const unevaluatedLayoutValues = layer._unevaluatedLayout._values;

    this.textSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['text-size']);
    this.iconSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['icon-size']);

    const layout = this.layers[0].layout;
    const zOrderByViewportY = layout.get('symbol-z-order') === 'viewport-y';
    this.sortFeaturesByY =
      zOrderByViewportY &&
      (layout.get('text-allow-overlap') ||
        layout.get('icon-allow-overlap') ||
        layout.get('text-ignore-placement') ||
        layout.get('icon-ignore-placement'));

    this.sourceID = options.sourceID;
  }

  createArrays() {
    this.text = new SymbolBuffers(
      new ProgramConfigurationSet(symbolLayoutAttributes.members, this.layers, this.zoom, property =>
        /^text/.test(property)
      )
    );
    this.icon = new SymbolBuffers(
      new ProgramConfigurationSet(symbolLayoutAttributes.members, this.layers, this.zoom, property =>
        /^icon/.test(property)
      )
    );

    this.collisionBox = new CollisionBuffers(CollisionBoxLayoutArray, collisionBoxLayout.members, LineIndexArray);
    this.collisionCircle = new CollisionBuffers(
      CollisionCircleLayoutArray,
      collisionCircleLayout.members,
      TriangleIndexArray
    );

    this.glyphOffsetArray = new GlyphOffsetArray();
    this.lineVertexArray = new SymbolLineVertexArray();
    this.symbolInstances = new SymbolInstanceArray();
  }

  calculateGlyphDependencies(text, stack, textAlongLine, doesAllowVerticalWritingMode) {
    for (let i = 0; i < text.length; i++) {
      stack[text.charCodeAt(i)] = true;
      if (textAlongLine && doesAllowVerticalWritingMode) {
        const verticalChar = verticalizedCharacterMap[text.charAt(i)];
        if (verticalChar) {
          stack[verticalChar.charCodeAt(0)] = true;
        }
      }
    }
  }

  populate(features, options) {
    const layer = this.layers[0];
    const layout = layer.layout;

    const textFont = layout.get('text-font');
    const textField = layout.get('text-field');
    const iconImage = layout.get('icon-image');
    const hasText =
      (textField.value.kind !== 'constant' || textField.value.value.toString().length > 0) &&
      (textFont.value.kind !== 'constant' || textFont.value.value.length > 0);
    const hasIcon = iconImage.value.kind !== 'constant' || (iconImage.value.value && iconImage.value.value.length > 0);

    this.features = [];

    if (!hasText && !hasIcon) {
      return;
    }

    const icons = options.iconDependencies;
    const stacks = options.glyphDependencies;
    const globalProperties = new EvaluationParameters(this.zoom, { globalState: this.globalState });

    for (const { feature, index, sourceLayerIndex } of features) {
      if (!layer._featureFilter(globalProperties, feature)) {
        continue;
      }

      let text;
      if (hasText) {
        // Expression evaluation will automatically coerce to Formatted
        // but plain string token evaluation skips that pathway so do the
        // conversion here.
        const resolvedTokens = layer.getValueAndResolveTokens('text-field', feature);
        text = transformText(
          resolvedTokens instanceof Formatted ? resolvedTokens : Formatted.fromString(resolvedTokens),
          layer,
          feature
        );
      }

      let icon;
      if (hasIcon) {
        icon = layer.getValueAndResolveTokens('icon-image', feature);
      }

      if (!text && !icon) {
        continue;
      }

      const symbolFeature = {
        text,
        icon,
        index,
        sourceLayerIndex,
        geometry: loadGeometry(feature),
        properties: feature.properties,
        type: vectorTileFeatureTypes[feature.type]
      };
      if (typeof feature.id !== 'undefined') {
        symbolFeature.id = feature.id;
      }
      this.features.push(symbolFeature);

      if (icon) {
        icons[icon] = true;
      }

      if (text) {
        const fontStack = textFont.evaluate(feature, {}).join(',');
        const textAlongLine =
          layout.get('text-rotation-alignment') === 'map' && layout.get('symbol-placement') !== 'point';
        for (const section of text.sections) {
          const doesAllowVerticalWritingMode = allowsVerticalWritingMode(text.toString());
          const sectionFont = section.fontStack || fontStack;
          const sectionStack = (stacks[sectionFont] = stacks[sectionFont] || {});
          this.calculateGlyphDependencies(section.text, sectionStack, textAlongLine, doesAllowVerticalWritingMode);
        }
      }
    }

    if (layout.get('symbol-placement') === 'line') {
      // Merge adjacent lines with the same text to improve labelling.
      // It's better to place labels on one long line than on many short segments.
      this.features = mergeLines(this.features);
    }
  }

  update(states, vtLayer, imagePositions) {
    if (!this.stateDependentLayers.length) return;
    this.text.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, imagePositions);
    this.icon.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, imagePositions);
  }

  isEmpty() {
    return this.symbolInstances.length === 0;
  }

  uploadPending() {
    return !this.uploaded || this.text.programConfigurations.needsUpload || this.icon.programConfigurations.needsUpload;
  }

  upload(context) {
    if (!this.uploaded) {
      this.collisionBox.upload(context);
      this.collisionCircle.upload(context);
    }
    this.text.upload(context, this.sortFeaturesByY, !this.uploaded, this.text.programConfigurations.needsUpload);
    this.icon.upload(context, this.sortFeaturesByY, !this.uploaded, this.icon.programConfigurations.needsUpload);
    this.uploaded = true;
  }

  destroy() {
    this.text.destroy();
    this.icon.destroy();
    this.collisionBox.destroy();
    this.collisionCircle.destroy();
  }

  addToLineVertexArray(anchor, line) {
    const lineStartIndex = this.lineVertexArray.length;
    if (anchor.segment !== undefined) {
      let sumForwardLength = anchor.dist(line[anchor.segment + 1]);
      let sumBackwardLength = anchor.dist(line[anchor.segment]);
      const vertices = {};
      for (let i = anchor.segment + 1; i < line.length; i++) {
        vertices[i] = { x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumForwardLength };
        if (i < line.length - 1) {
          sumForwardLength += line[i + 1].dist(line[i]);
        }
      }
      for (let i = anchor.segment || 0; i >= 0; i--) {
        vertices[i] = { x: line[i].x, y: line[i].y, tileUnitDistanceFromAnchor: sumBackwardLength };
        if (i > 0) {
          sumBackwardLength += line[i - 1].dist(line[i]);
        }
      }
      for (let i = 0; i < line.length; i++) {
        const vertex = vertices[i];
        this.lineVertexArray.emplaceBack(vertex.x, vertex.y, vertex.tileUnitDistanceFromAnchor);
      }
    }
    return {
      lineStartIndex: lineStartIndex,
      lineLength: this.lineVertexArray.length - lineStartIndex
    };
  }

  addSymbols(
    arrays,
    quads,
    sizeVertex,
    lineOffset,
    alongLine,
    feature,
    writingMode,
    labelAnchor,
    lineStartIndex,
    lineLength
  ) {
    const indexArray = arrays.indexArray;
    const layoutVertexArray = arrays.layoutVertexArray;
    const dynamicLayoutVertexArray = arrays.dynamicLayoutVertexArray;

    const segment = arrays.segments.prepareSegment(4 * quads.length, arrays.layoutVertexArray, arrays.indexArray);
    const glyphOffsetArrayStart = this.glyphOffsetArray.length;
    const vertexStartIndex = segment.vertexLength;

    for (const symbol of quads) {
      const tl = symbol.tl;
      const tr = symbol.tr;
      const bl = symbol.bl;
      const br = symbol.br;
      const tex = symbol.tex;

      const index = segment.vertexLength;

      const y = symbol.glyphOffset[1];
      addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tl.x, y + tl.y, tex.x, tex.y, sizeVertex);
      addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex);
      addVertex(layoutVertexArray, labelAnchor.x, labelAnchor.y, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex);
      addVertex(
        layoutVertexArray,
        labelAnchor.x,
        labelAnchor.y,
        br.x,
        y + br.y,
        tex.x + tex.w,
        tex.y + tex.h,
        sizeVertex
      );

      addDynamicAttributes(dynamicLayoutVertexArray, labelAnchor, 0);

      indexArray.emplaceBack(index, index + 1, index + 2);
      indexArray.emplaceBack(index + 1, index + 2, index + 3);

      segment.vertexLength += 4;
      segment.primitiveLength += 2;

      this.glyphOffsetArray.emplaceBack(symbol.glyphOffset[0]);
    }

    arrays.placedSymbolArray.emplaceBack(
      labelAnchor.x,
      labelAnchor.y,
      glyphOffsetArrayStart,
      this.glyphOffsetArray.length - glyphOffsetArrayStart,
      vertexStartIndex,
      lineStartIndex,
      lineLength,
      labelAnchor.segment,
      sizeVertex ? sizeVertex[0] : 0,
      sizeVertex ? sizeVertex[1] : 0,
      lineOffset[0],
      lineOffset[1],
      writingMode,
      false
    );

    arrays.programConfigurations.populatePaintArrays(arrays.layoutVertexArray.length, feature, feature.index, {});
  }

  _addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, point, anchorX, anchorY, extrude) {
    collisionVertexArray.emplaceBack(0, 0);
    return layoutVertexArray.emplaceBack(
      // pos
      point.x,
      point.y,
      // a_anchor_pos
      anchorX,
      anchorY,
      // extrude
      Math.round(extrude.x),
      Math.round(extrude.y)
    );
  }

  addCollisionDebugVertices(x1, y1, x2, y2, arrays, boxAnchorPoint, symbolInstance, isCircle) {
    const segment = arrays.segments.prepareSegment(4, arrays.layoutVertexArray, arrays.indexArray);
    const index = segment.vertexLength;

    const layoutVertexArray = arrays.layoutVertexArray;
    const collisionVertexArray = arrays.collisionVertexArray;

    const anchorX = symbolInstance.anchorX;
    const anchorY = symbolInstance.anchorY;

    this._addCollisionDebugVertex(
      layoutVertexArray,
      collisionVertexArray,
      boxAnchorPoint,
      anchorX,
      anchorY,
      new Point(x1, y1)
    );
    this._addCollisionDebugVertex(
      layoutVertexArray,
      collisionVertexArray,
      boxAnchorPoint,
      anchorX,
      anchorY,
      new Point(x2, y1)
    );
    this._addCollisionDebugVertex(
      layoutVertexArray,
      collisionVertexArray,
      boxAnchorPoint,
      anchorX,
      anchorY,
      new Point(x2, y2)
    );
    this._addCollisionDebugVertex(
      layoutVertexArray,
      collisionVertexArray,
      boxAnchorPoint,
      anchorX,
      anchorY,
      new Point(x1, y2)
    );

    segment.vertexLength += 4;
    if (isCircle) {
      const indexArray = arrays.indexArray;
      indexArray.emplaceBack(index, index + 1, index + 2);
      indexArray.emplaceBack(index, index + 2, index + 3);

      segment.primitiveLength += 2;
    } else {
      const indexArray = arrays.indexArray;
      indexArray.emplaceBack(index, index + 1);
      indexArray.emplaceBack(index + 1, index + 2);
      indexArray.emplaceBack(index + 2, index + 3);
      indexArray.emplaceBack(index + 3, index);

      segment.primitiveLength += 4;
    }
  }

  addDebugCollisionBoxes(startIndex, endIndex, symbolInstance) {
    for (let b = startIndex; b < endIndex; b++) {
      const box = this.collisionBoxArray.get(b);
      const x1 = box.x1;
      const y1 = box.y1;
      const x2 = box.x2;
      const y2 = box.y2;

      // If the radius > 0, this collision box is actually a circle
      // The data we add to the buffers is exactly the same, but we'll render with a different shader.
      const isCircle = box.radius > 0;
      this.addCollisionDebugVertices(
        x1,
        y1,
        x2,
        y2,
        isCircle ? this.collisionCircle : this.collisionBox,
        box.anchorPoint,
        symbolInstance,
        isCircle
      );
    }
  }

  generateCollisionDebugBuffers() {
    for (let i = 0; i < this.symbolInstances.length; i++) {
      const symbolInstance = this.symbolInstances.get(i);
      this.addDebugCollisionBoxes(symbolInstance.textBoxStartIndex, symbolInstance.textBoxEndIndex, symbolInstance);
      this.addDebugCollisionBoxes(symbolInstance.iconBoxStartIndex, symbolInstance.iconBoxEndIndex, symbolInstance);
    }
  }

  // These flat arrays are meant to be quicker to iterate over than the source
  // CollisionBoxArray
  _deserializeCollisionBoxesForSymbol(collisionBoxArray, textStartIndex, textEndIndex, iconStartIndex, iconEndIndex) {
    const collisionArrays = {};
    for (let k = textStartIndex; k < textEndIndex; k++) {
      const box = collisionBoxArray.get(k);
      if (box.radius === 0) {
        collisionArrays.textBox = {
          x1: box.x1,
          y1: box.y1,
          x2: box.x2,
          y2: box.y2,
          anchorPointX: box.anchorPointX,
          anchorPointY: box.anchorPointY
        };
        collisionArrays.textFeatureIndex = box.featureIndex;
        break; // Only one box allowed per instance
      }
      if (!collisionArrays.textCircles) {
        collisionArrays.textCircles = [];
        collisionArrays.textFeatureIndex = box.featureIndex;
      }
      const used = 1; // May be updated at collision detection time
      collisionArrays.textCircles.push(
        box.anchorPointX,
        box.anchorPointY,
        box.radius,
        box.signedDistanceFromAnchor,
        used
      );
    }
    for (let k = iconStartIndex; k < iconEndIndex; k++) {
      // An icon can only have one box now, so this indexing is a bit vestigial...
      const box = collisionBoxArray.get(k);
      if (box.radius === 0) {
        collisionArrays.iconBox = {
          x1: box.x1,
          y1: box.y1,
          x2: box.x2,
          y2: box.y2,
          anchorPointX: box.anchorPointX,
          anchorPointY: box.anchorPointY
        };
        collisionArrays.iconFeatureIndex = box.featureIndex;
        break; // Only one box allowed per instance
      }
    }
    return collisionArrays;
  }

  deserializeCollisionBoxes(collisionBoxArray) {
    this.collisionArrays = [];
    for (let i = 0; i < this.symbolInstances.length; i++) {
      const symbolInstance = this.symbolInstances.get(i);
      this.collisionArrays.push(
        this._deserializeCollisionBoxesForSymbol(
          collisionBoxArray,
          symbolInstance.textBoxStartIndex,
          symbolInstance.textBoxEndIndex,
          symbolInstance.iconBoxStartIndex,
          symbolInstance.iconBoxEndIndex
        )
      );
    }
  }

  hasTextData() {
    return this.text.segments.get().length > 0;
  }

  hasIconData() {
    return this.icon.segments.get().length > 0;
  }

  hasCollisionBoxData() {
    return this.collisionBox.segments.get().length > 0;
  }

  hasCollisionCircleData() {
    return this.collisionCircle.segments.get().length > 0;
  }

  addIndicesForPlacedTextSymbol(placedTextSymbolIndex) {
    const placedSymbol = this.text.placedSymbolArray.get(placedTextSymbolIndex);

    const endIndex = placedSymbol.vertexStartIndex + placedSymbol.numGlyphs * 4;
    for (let vertexIndex = placedSymbol.vertexStartIndex; vertexIndex < endIndex; vertexIndex += 4) {
      this.text.indexArray.emplaceBack(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      this.text.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
    }
  }

  sortFeatures(angle) {
    if (!this.sortFeaturesByY) return;

    if (this.sortedAngle === angle) return;
    this.sortedAngle = angle;

    // The current approach to sorting doesn't sort across segments so don't try.
    // Sorting within segments separately seemed not to be worth the complexity.
    if (this.text.segments.get().length > 1 || this.icon.segments.get().length > 1) return;

    // If the symbols are allowed to overlap sort them by their vertical screen position.
    // The index array buffer is rewritten to reference the (unchanged) vertices in the
    // sorted order.

    // To avoid sorting the actual symbolInstance array we sort an array of indexes.
    const symbolInstanceIndexes = [];
    for (let i = 0; i < this.symbolInstances.length; i++) {
      symbolInstanceIndexes.push(i);
    }

    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    const rotatedYs = [];
    const featureIndexes = [];
    for (let i = 0; i < this.symbolInstances.length; i++) {
      const symbolInstance = this.symbolInstances.get(i);
      rotatedYs.push(Math.round(sin * symbolInstance.anchorX + cos * symbolInstance.anchorY) | 0);
      featureIndexes.push(symbolInstance.featureIndex);
    }

    symbolInstanceIndexes.sort((aIndex, bIndex) => {
      return rotatedYs[aIndex] - rotatedYs[bIndex] || featureIndexes[bIndex] - featureIndexes[aIndex];
    });

    this.text.indexArray.clear();
    this.icon.indexArray.clear();

    this.featureSortOrder = [];

    for (const i of symbolInstanceIndexes) {
      const symbolInstance = this.symbolInstances.get(i);
      this.featureSortOrder.push(symbolInstance.featureIndex);

      if (symbolInstance.horizontalPlacedTextSymbolIndex >= 0) {
        this.addIndicesForPlacedTextSymbol(symbolInstance.horizontalPlacedTextSymbolIndex);
      }
      if (symbolInstance.verticalPlacedTextSymbolIndex >= 0) {
        this.addIndicesForPlacedTextSymbol(symbolInstance.verticalPlacedTextSymbolIndex);
      }

      const placedIcon = this.icon.placedSymbolArray.get(i);
      if (placedIcon.numGlyphs) {
        const vertexIndex = placedIcon.vertexStartIndex;
        this.icon.indexArray.emplaceBack(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        this.icon.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
      }
    }

    if (this.text.indexBuffer) this.text.indexBuffer.updateData(this.text.indexArray);
    if (this.icon.indexBuffer) this.icon.indexBuffer.updateData(this.icon.indexArray);
  }
}

register('SymbolBucket', SymbolBucket, {
  omit: ['layers', 'collisionBoxArray', 'features', 'compareText']
});

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, glyphOffsetArrayStart
// eg the max valid UInt16 is 65,535
// See https://github.com/mapbox/mapbox-gl-js/issues/2907 for motivation
// lineStartIndex and textBoxStartIndex could potentially be concerns
// but we expect there to be many fewer boxes/lines than glyphs
SymbolBucket.MAX_GLYPHS = 65535;

SymbolBucket.addDynamicAttributes = addDynamicAttributes;

module.exports = SymbolBucket;
