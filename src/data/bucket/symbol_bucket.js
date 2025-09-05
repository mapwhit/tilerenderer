import { Formatted } from '@mapwhit/style-expressions';
import { VectorTileFeature } from '@mapwhit/vector-tile';
import EvaluationParameters from '../../style/evaluation_parameters.js';
import mergeLines from '../../symbol/mergelines.js';
import { getSizeData } from '../../symbol/symbol_size.js';
import transformText from '../../symbol/transform_text.js';
import { allowsVerticalWritingMode } from '../../util/script_detection.js';
import { verticalizedCharacterMap } from '../../util/verticalize_punctuation.js';
import {
  CollisionBoxLayoutArray,
  CollisionCircleLayoutArray,
  GlyphOffsetArray,
  SymbolInstanceArray,
  SymbolLineVertexArray
} from '../array_types.js';
import { LineIndexArray, TriangleIndexArray } from '../index_array_type.js';
import loadGeometry from '../load_geometry.js';
import { ProgramConfigurationSet } from '../program_configuration.js';
import { collisionBoxLayout, collisionCircleLayout, symbolLayoutAttributes } from './symbol_attributes.js';
import SymbolBuffers from './symbol_buffers.js';
import CollisionBuffers from './symbol_collision_buffers.js';

const vectorTileFeatureTypes = VectorTileFeature.types;

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

export function addDynamicAttributes(dynamicLayoutVertexArray, p, angle) {
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
  dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}

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
export default class SymbolBucket {
  constructor(options) {
    this.collisionBoxArray = options.collisionBoxArray;
    this.zoom = options.zoom;
    this.overscaling = options.overscaling;
    this.layers = options.layers;
    this.index = options.index;
    this.pixelRatio = options.pixelRatio;
    this.sourceLayerIndex = options.sourceLayerIndex;
    this.hasPattern = false;

    const layer = this.layers[0];
    const unevaluatedLayoutValues = layer._unevaluatedLayout._values;

    this.textSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['text-size']);
    this.iconSizeData = getSizeData(this.zoom, unevaluatedLayoutValues['icon-size']);

    const layout = this.layers[0]._layout;
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

  populate(features, options) {
    const layer = this.layers[0];
    const layout = layer._layout;

    const textFont = layout.get('text-font');
    const textField = layout.get('text-field');
    const iconImage = layout.get('icon-image');
    const hasText =
      (textField.value.kind !== 'constant' || textField.value.value.toString().length > 0) &&
      (textFont.value.kind !== 'constant' || textFont.value.value.length > 0);
    const hasIcon = iconImage.value.kind !== 'constant' || iconImage.value.value?.length > 0;

    this.features = [];

    if (!hasText && !hasIcon) {
      return;
    }

    const icons = options.iconDependencies;
    const stacks = options.glyphDependencies;
    const globalProperties = new EvaluationParameters(this.zoom);

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
          calculateGlyphDependencies(section.text, sectionStack, textAlongLine, doesAllowVerticalWritingMode);
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
    if (!this.stateDependentLayers.length) {
      return;
    }
    this.text.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, {
      imagePositions
    });
    this.icon.programConfigurations.updatePaintArrays(states, vtLayer, this.layers, {
      imagePositions
    });
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
    const { indexArray, layoutVertexArray, dynamicLayoutVertexArray, segments } = arrays;
    const segment = segments.prepareSegment(4 * quads.length, layoutVertexArray, indexArray);
    const glyphOffsetArrayStart = this.glyphOffsetArray.length;
    const vertexStartIndex = segment.vertexLength;
    const { x: lax, y: lay } = labelAnchor;

    for (const { tl, tr, bl, br, tex, glyphOffset } of quads) {
      const y = glyphOffset[1];

      addVertex(layoutVertexArray, lax, lay, tl.x, y + tl.y, tex.x, tex.y, sizeVertex);
      addVertex(layoutVertexArray, lax, lay, tr.x, y + tr.y, tex.x + tex.w, tex.y, sizeVertex);
      addVertex(layoutVertexArray, lax, lay, bl.x, y + bl.y, tex.x, tex.y + tex.h, sizeVertex);
      addVertex(layoutVertexArray, lax, lay, br.x, y + br.y, tex.x + tex.w, tex.y + tex.h, sizeVertex);

      addDynamicAttributes(dynamicLayoutVertexArray, labelAnchor, 0);

      const index = segment.vertexLength;

      indexArray.emplaceBack(index, index + 1, index + 2);
      indexArray.emplaceBack(index + 1, index + 2, index + 3);

      segment.vertexLength += 4;
      segment.primitiveLength += 2;

      this.glyphOffsetArray.emplaceBack(glyphOffset[0]);
    }

    arrays.placedSymbolArray.emplaceBack(
      lax,
      lay,
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

    arrays.programConfigurations.populatePaintArrays(arrays.layoutVertexArray.length, feature, feature.index, {
      imagePositions: {}
    });
  }

  addCollisionDebugVertices(x1, y1, x2, y2, arrays, boxAnchorPoint, symbolInstance, isCircle) {
    const { layoutVertexArray, collisionVertexArray, indexArray } = arrays;
    const { anchorX, anchorY } = symbolInstance;

    const segment = arrays.segments.prepareSegment(4, layoutVertexArray, indexArray);
    const index = segment.vertexLength;

    addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, x1, y1);
    addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, x2, y1);
    addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, x2, y2);
    addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, boxAnchorPoint, anchorX, anchorY, x1, y2);

    segment.vertexLength += 4;
    if (isCircle) {
      indexArray.emplaceBack(index, index + 1, index + 2);
      indexArray.emplaceBack(index, index + 2, index + 3);

      segment.primitiveLength += 2;
    } else {
      indexArray.emplaceBack(index, index + 1);
      indexArray.emplaceBack(index + 1, index + 2);
      indexArray.emplaceBack(index + 2, index + 3);
      indexArray.emplaceBack(index + 3, index);

      segment.primitiveLength += 4;
    }
  }

  addDebugCollisionBoxes(startIndex, endIndex, symbolInstance) {
    for (let b = startIndex; b < endIndex; b++) {
      const { x1, y1, x2, y2, radius, anchorPoint } = this.collisionBoxArray.get(b);

      // If the radius > 0, this collision box is actually a circle
      // The data we add to the buffers is exactly the same, but we'll render with a different shader.
      const isCircle = radius > 0;
      this.addCollisionDebugVertices(
        x1,
        y1,
        x2,
        y2,
        isCircle ? this.collisionCircle : this.collisionBox,
        anchorPoint,
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

  deserializeCollisionBoxes(collisionBoxArray) {
    this.collisionArrays = new Array(this.symbolInstances.length);
    for (let i = 0; i < this.symbolInstances.length; i++) {
      const symbolInstance = this.symbolInstances.get(i);
      this.collisionArrays[i] = deserializeCollisionBoxesForSymbol(
        collisionBoxArray,
        symbolInstance.textBoxStartIndex,
        symbolInstance.textBoxEndIndex,
        symbolInstance.iconBoxStartIndex,
        symbolInstance.iconBoxEndIndex
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
    if (!this.sortFeaturesByY) {
      return;
    }

    if (this.sortedAngle === angle) {
      return;
    }
    this.sortedAngle = angle;

    // The current approach to sorting doesn't sort across segments so don't try.
    // Sorting within segments separately seemed not to be worth the complexity.
    if (this.text.segments.get().length > 1 || this.icon.segments.get().length > 1) {
      return;
    }

    // If the symbols are allowed to overlap sort them by their vertical screen position.
    // The index array buffer is rewritten to reference the (unchanged) vertices in the
    // sorted order.

    // To avoid sorting the actual symbolInstance array we sort an array of indexes.
    const slen = this.symbolInstances.length;
    const symbolInstanceIndexes = new Array(slen);
    const rotatedYs = new Array(slen);
    const featureIndexes = new Array(slen);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    for (let i = 0; i < slen; i++) {
      symbolInstanceIndexes[i] = i;
      const { anchorX, anchorY, featureIndex } = this.symbolInstances.get(i);
      rotatedYs[i] = Math.round(sin * anchorX + cos * anchorY) | 0;
      featureIndexes[i] = featureIndex;
    }

    symbolInstanceIndexes.sort((a, b) => rotatedYs[a] - rotatedYs[b] || featureIndexes[b] - featureIndexes[a]);

    this.text.indexArray.clear();
    this.icon.indexArray.clear();

    this.featureSortOrder = new Array(slen);

    for (let i = 0; i < slen; i++) {
      const index = symbolInstanceIndexes[i];
      const { featureIndex, horizontalPlacedTextSymbolIndex, verticalPlacedTextSymbolIndex } =
        this.symbolInstances.get(index);
      this.featureSortOrder[i] = featureIndex;

      if (horizontalPlacedTextSymbolIndex >= 0) {
        this.addIndicesForPlacedTextSymbol(horizontalPlacedTextSymbolIndex);
      }
      if (verticalPlacedTextSymbolIndex >= 0) {
        this.addIndicesForPlacedTextSymbol(verticalPlacedTextSymbolIndex);
      }

      const { numGlyphs, vertexStartIndex: vertexIndex } = this.icon.placedSymbolArray.get(index);
      if (numGlyphs) {
        this.icon.indexArray.emplaceBack(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        this.icon.indexArray.emplaceBack(vertexIndex + 1, vertexIndex + 2, vertexIndex + 3);
      }
    }

    if (this.text.indexBuffer) {
      this.text.indexBuffer.updateData(this.text.indexArray);
    }
    if (this.icon.indexBuffer) {
      this.icon.indexBuffer.updateData(this.icon.indexArray);
    }
  }
}

function addCollisionDebugVertex(layoutVertexArray, collisionVertexArray, point, anchorX, anchorY, extrudeX, extrudeY) {
  collisionVertexArray.emplaceBack(0, 0);
  return layoutVertexArray.emplaceBack(
    // pos
    point.x,
    point.y,
    // a_anchor_pos
    anchorX,
    anchorY,
    // extrude
    Math.round(extrudeX),
    Math.round(extrudeY)
  );
}

// These flat arrays are meant to be quicker to iterate over than the source
// CollisionBoxArray
function deserializeCollisionBoxesForSymbol(
  collisionBoxArray,
  textStartIndex,
  textEndIndex,
  iconStartIndex,
  iconEndIndex
) {
  const collisionArrays = {};
  for (let k = textStartIndex; k < textEndIndex; k++) {
    const { x1, y1, x2, y2, anchorPointX, anchorPointY, featureIndex, radius, signedDistanceFromAnchor } =
      collisionBoxArray.get(k);
    if (radius === 0) {
      collisionArrays.textBox = {
        x1,
        y1,
        x2,
        y2,
        anchorPointX,
        anchorPointY
      };
      collisionArrays.textFeatureIndex = featureIndex;
      break; // Only one box allowed per instance
    }
    if (!collisionArrays.textCircles) {
      collisionArrays.textCircles = [];
      collisionArrays.textFeatureIndex = featureIndex;
    }
    const used = 1; // May be updated at collision detection time
    collisionArrays.textCircles.push(anchorPointX, anchorPointY, radius, signedDistanceFromAnchor, used);
  }
  for (let k = iconStartIndex; k < iconEndIndex; k++) {
    // An icon can only have one box now, so this indexing is a bit vestigial...
    const box = collisionBoxArray.get(k);
    if (box.radius === 0) {
      const { x1, y1, x2, y2, anchorPointX, anchorPointY, featureIndex } = box;
      collisionArrays.iconBox = {
        x1,
        y1,
        x2,
        y2,
        anchorPointX,
        anchorPointY
      };
      collisionArrays.iconFeatureIndex = featureIndex;
      break; // Only one box allowed per instance
    }
  }
  return collisionArrays;
}

// this constant is based on the size of StructArray indexes used in a symbol
// bucket--namely, glyphOffsetArrayStart
// eg the max valid UInt16 is 65,535
// See https://github.com/mapbox/mapbox-gl-js/issues/2907 for motivation
// lineStartIndex and textBoxStartIndex could potentially be concerns
// but we expect there to be many fewer boxes/lines than glyphs
SymbolBucket.MAX_GLYPHS = 65535;

function calculateGlyphDependencies(text, stack, textAlongLine, doesAllowVerticalWritingMode) {
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
