const { createLayout } = require('../../util/struct_array');

const symbolLayoutAttributes = createLayout([
  { name: 'a_pos_offset', components: 4, type: 'Int16' },
  { name: 'a_data', components: 4, type: 'Uint16' }
]);

const dynamicLayoutAttributes = createLayout([{ name: 'a_projected_pos', components: 3, type: 'Float32' }], 4);

const placementOpacityAttributes = createLayout([{ name: 'a_fade_opacity', components: 1, type: 'Uint32' }], 4);

const collisionVertexAttributes = createLayout([{ name: 'a_placed', components: 2, type: 'Uint8' }], 4);

const collisionBox = createLayout([
  // the box is centered around the anchor point
  { type: 'Int16', name: 'anchorPointX' },
  { type: 'Int16', name: 'anchorPointY' },

  // distances to the edges from the anchor
  { type: 'Int16', name: 'x1' },
  { type: 'Int16', name: 'y1' },
  { type: 'Int16', name: 'x2' },
  { type: 'Int16', name: 'y2' },

  // the index of the feature in the original vectortile
  { type: 'Uint32', name: 'featureIndex' },
  // the source layer the feature appears in
  { type: 'Uint16', name: 'sourceLayerIndex' },
  // the bucket the feature appears in
  { type: 'Uint16', name: 'bucketIndex' },

  // collision circles for lines store their distance to the anchor in tile units
  // so that they can be ignored if the projected label doesn't extend into
  // the box area
  { type: 'Int16', name: 'radius' },
  { type: 'Int16', name: 'signedDistanceFromAnchor' }
]);

const collisionBoxLayout = createLayout(
  [
    // used to render collision boxes for debugging purposes
    { name: 'a_pos', components: 2, type: 'Int16' },
    { name: 'a_anchor_pos', components: 2, type: 'Int16' },
    { name: 'a_extrude', components: 2, type: 'Int16' }
  ],
  4
);

const collisionCircleLayout = createLayout(
  [
    // used to render collision circles for debugging purposes
    { name: 'a_pos', components: 2, type: 'Int16' },
    { name: 'a_anchor_pos', components: 2, type: 'Int16' },
    { name: 'a_extrude', components: 2, type: 'Int16' }
  ],
  4
);

const placement = createLayout([
  { type: 'Int16', name: 'anchorX' },
  { type: 'Int16', name: 'anchorY' },
  { type: 'Uint16', name: 'glyphStartIndex' },
  { type: 'Uint16', name: 'numGlyphs' },
  { type: 'Uint32', name: 'vertexStartIndex' },
  { type: 'Uint32', name: 'lineStartIndex' },
  { type: 'Uint32', name: 'lineLength' },
  { type: 'Uint16', name: 'segment' },
  { type: 'Uint16', name: 'lowerSize' },
  { type: 'Uint16', name: 'upperSize' },
  { type: 'Float32', name: 'lineOffsetX' },
  { type: 'Float32', name: 'lineOffsetY' },
  { type: 'Uint8', name: 'writingMode' },
  { type: 'Uint8', name: 'hidden' }
]);

const symbolInstance = createLayout([
  { type: 'Int16', name: 'anchorX' },
  { type: 'Int16', name: 'anchorY' },
  { type: 'Int16', name: 'horizontalPlacedTextSymbolIndex' },
  { type: 'Int16', name: 'verticalPlacedTextSymbolIndex' },
  { type: 'Uint16', name: 'key' },
  { type: 'Uint16', name: 'textBoxStartIndex' },
  { type: 'Uint16', name: 'textBoxEndIndex' },
  { type: 'Uint16', name: 'iconBoxStartIndex' },
  { type: 'Uint16', name: 'iconBoxEndIndex' },
  { type: 'Uint16', name: 'featureIndex' },
  { type: 'Uint16', name: 'numGlyphVertices' },
  { type: 'Uint16', name: 'numVerticalGlyphVertices' },
  { type: 'Uint16', name: 'numIconVertices' },
  { type: 'Uint32', name: 'crossTileID' }
]);

const glyphOffset = createLayout([{ type: 'Float32', name: 'offsetX' }]);

const lineVertex = createLayout([
  { type: 'Int16', name: 'x' },
  { type: 'Int16', name: 'y' },
  { type: 'Int16', name: 'tileUnitDistanceFromAnchor' }
]);

module.exports = {
  symbolLayoutAttributes,
  dynamicLayoutAttributes,
  placementOpacityAttributes,
  collisionVertexAttributes,
  collisionBox,
  collisionBoxLayout,
  collisionCircleLayout,
  placement,
  symbolInstance,
  glyphOffset,
  lineVertex
};
