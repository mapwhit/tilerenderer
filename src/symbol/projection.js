const { default: Point } = require('@mapbox/point-geometry');

const { mat4, vec4 } = require('@mapbox/gl-matrix');
const symbolSize = require('./symbol_size');
const { addDynamicAttributes } = require('../data/bucket/symbol_bucket');
const properties = require('../style/style_layer/symbol_style_layer_properties');
const symbolLayoutProperties = properties.layout;

const { WritingMode } = require('../symbol/shaping');

module.exports = {
  updateLineLabels,
  getLabelPlaneMatrix,
  getGlCoordMatrix,
  project,
  placeFirstAndLastGlyph,
  xyTransformMat4
};

/*
 * # Overview of coordinate spaces
 *
 * ## Tile coordinate spaces
 * Each label has an anchor. Some labels have corresponding line geometries.
 * The points for both anchors and lines are stored in tile units. Each tile has it's own
 * coordinate space going from (0, 0) at the top left to (EXTENT, EXTENT) at the bottom right.
 *
 * ## GL coordinate space
 * At the end of everything, the vertex shader needs to produce a position in GL coordinate space,
 * which is (-1, 1) at the top left and (1, -1) in the bottom right.
 *
 * ## Map pixel coordinate spaces
 * Each tile has a pixel coordinate space. It's just the tile units scaled so that one unit is
 * whatever counts as 1 pixel at the current zoom.
 * This space is used for pitch-alignment=map, rotation-alignment=map
 *
 * ## Rotated map pixel coordinate spaces
 * Like the above, but rotated so axis of the space are aligned with the viewport instead of the tile.
 * This space is used for pitch-alignment=map, rotation-alignment=viewport
 *
 * ## Viewport pixel coordinate space
 * (0, 0) is at the top left of the canvas and (pixelWidth, pixelHeight) is at the bottom right corner
 * of the canvas. This space is used for pitch-alignment=viewport
 *
 *
 * # Vertex projection
 * It goes roughly like this:
 * 1. project the anchor and line from tile units into the correct label coordinate space
 *      - map pixel space           pitch-alignment=map         rotation-alignment=map
 *      - rotated map pixel space   pitch-alignment=map         rotation-alignment=viewport
 *      - viewport pixel space      pitch-alignment=viewport    rotation-alignment=*
 * 2. if the label follows a line, find the point along the line that is the correct distance from the anchor.
 * 3. add the glyph's corner offset to the point from step 3
 * 4. convert from the label coordinate space to gl coordinates
 *
 * For horizontal labels we want to do step 1 in the shader for performance reasons (no cpu work).
 *      This is what `u_label_plane_matrix` is used for.
 * For labels aligned with lines we have to steps 1 and 2 on the cpu since we need access to the line geometry.
 *      This is what `updateLineLabels(...)` does.
 *      Since the conversion is handled on the cpu we just set `u_label_plane_matrix` to an identity matrix.
 *
 * Steps 3 and 4 are done in the shaders for all labels.
 */

/*
 * Returns a matrix for converting from tile units to the correct label coordinate space.
 */
function getLabelPlaneMatrix(posMatrix, pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
  const m = mat4.identity(new Float32Array(16));
  if (pitchWithMap) {
    mat4.identity(m);
    mat4.scale(m, m, [1 / pixelsToTileUnits, 1 / pixelsToTileUnits, 1]);
    if (!rotateWithMap) {
      mat4.rotateZ(m, m, transform.angle);
    }
  } else {
    mat4.scale(m, m, [transform.width / 2, -transform.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    mat4.multiply(m, m, posMatrix);
  }
  return m;
}

/*
 * Returns a matrix for converting from the correct label coordinate space to gl coords.
 */
function getGlCoordMatrix(posMatrix, pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
  const m = mat4.identity(new Float32Array(16));
  if (pitchWithMap) {
    mat4.multiply(m, m, posMatrix);
    mat4.scale(m, m, [pixelsToTileUnits, pixelsToTileUnits, 1]);
    if (!rotateWithMap) {
      mat4.rotateZ(m, m, -transform.angle);
    }
  } else {
    mat4.scale(m, m, [1, -1, 1]);
    mat4.translate(m, m, [-1, -1, 0]);
    mat4.scale(m, m, [2 / transform.width, 2 / transform.height, 1]);
  }
  return m;
}

function project(point, matrix) {
  const pos = [point.x, point.y, 0, 1];
  xyTransformMat4(pos, pos, matrix);
  const w = pos[3];
  return {
    point: new Point(pos[0] / w, pos[1] / w),
    signedDistanceFromCamera: w
  };
}

function isVisible(anchorPos, clippingBuffer) {
  const x = anchorPos[0] / anchorPos[3];
  const y = anchorPos[1] / anchorPos[3];
  const inPaddedViewport =
    x >= -clippingBuffer[0] && x <= clippingBuffer[0] && y >= -clippingBuffer[1] && y <= clippingBuffer[1];
  return inPaddedViewport;
}

/*
 *  Update the `dynamicLayoutVertexBuffer` for the buffer with the correct glyph positions for the current map view.
 *  This is only run on labels that are aligned with lines. Horizontal labels are handled entirely in the shader.
 */
function updateLineLabels(
  bucket,
  posMatrix,
  painter,
  isText,
  labelPlaneMatrix,
  glCoordMatrix,
  pitchWithMap,
  keepUpright
) {
  const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
  const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(
    sizeData,
    painter.transform.zoom,
    symbolLayoutProperties.properties[isText ? 'text-size' : 'icon-size']
  );

  const clippingBuffer = [(256 / painter.width) * 2 + 1, (256 / painter.height) * 2 + 1];

  const dynamicLayoutVertexArray = isText ? bucket.text.dynamicLayoutVertexArray : bucket.icon.dynamicLayoutVertexArray;
  dynamicLayoutVertexArray.clear();

  const lineVertexArray = bucket.lineVertexArray;
  const placedSymbols = isText ? bucket.text.placedSymbolArray : bucket.icon.placedSymbolArray;

  const aspectRatio = painter.transform.width / painter.transform.height;

  let useVertical = false;

  for (let s = 0; s < placedSymbols.length; s++) {
    const symbol = placedSymbols.get(s);
    // Don't do calculations for vertical glyphs unless the previous symbol was horizontal
    // and we determined that vertical glyphs were necessary.
    // Also don't do calculations for symbols that are collided and fully faded out
    if (symbol.hidden || (symbol.writingMode === WritingMode.vertical && !useVertical)) {
      hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
      continue;
    }
    // Awkward... but we're counting on the paired "vertical" symbol coming immediately after its horizontal counterpart
    useVertical = false;

    const anchorPos = [symbol.anchorX, symbol.anchorY, 0, 1];
    vec4.transformMat4(anchorPos, anchorPos, posMatrix);

    // Don't bother calculating the correct point for invisible labels.
    if (!isVisible(anchorPos, clippingBuffer)) {
      hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
      continue;
    }

    const cameraToAnchorDistance = anchorPos[3];
    const perspectiveRatio = 0.5 + 0.5 * (cameraToAnchorDistance / painter.transform.cameraToCenterDistance);

    const fontSize = symbolSize.evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol);
    const pitchScaledFontSize = pitchWithMap ? fontSize * perspectiveRatio : fontSize / perspectiveRatio;

    const tileAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
    const anchorPoint = project(tileAnchorPoint, labelPlaneMatrix).point;
    const projectionCache = {};

    const placeUnflipped = placeGlyphsAlongLine(
      symbol,
      pitchScaledFontSize,
      false /*unflipped*/,
      keepUpright,
      posMatrix,
      labelPlaneMatrix,
      glCoordMatrix,
      bucket.glyphOffsetArray,
      lineVertexArray,
      dynamicLayoutVertexArray,
      anchorPoint,
      tileAnchorPoint,
      projectionCache,
      aspectRatio
    );

    useVertical = placeUnflipped.useVertical;

    if (
      placeUnflipped.notEnoughRoom ||
      useVertical ||
      (placeUnflipped.needsFlipping &&
        placeGlyphsAlongLine(
          symbol,
          pitchScaledFontSize,
          true /*flipped*/,
          keepUpright,
          posMatrix,
          labelPlaneMatrix,
          glCoordMatrix,
          bucket.glyphOffsetArray,
          lineVertexArray,
          dynamicLayoutVertexArray,
          anchorPoint,
          tileAnchorPoint,
          projectionCache,
          aspectRatio
        ).notEnoughRoom)
    ) {
      hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
    }
  }

  if (isText) {
    bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
  } else {
    bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray);
  }
}

function placeFirstAndLastGlyph(
  fontScale,
  glyphOffsetArray,
  lineOffsetX,
  lineOffsetY,
  flip,
  anchorPoint,
  tileAnchorPoint,
  symbol,
  lineVertexArray,
  labelPlaneMatrix,
  projectionCache,
  returnTileDistance
) {
  const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;
  const lineStartIndex = symbol.lineStartIndex;
  const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;

  const firstGlyphOffset = glyphOffsetArray.getoffsetX(symbol.glyphStartIndex);
  const lastGlyphOffset = glyphOffsetArray.getoffsetX(glyphEndIndex - 1);

  const firstPlacedGlyph = placeGlyphAlongLine(
    fontScale * firstGlyphOffset,
    lineOffsetX,
    lineOffsetY,
    flip,
    anchorPoint,
    tileAnchorPoint,
    symbol.segment,
    lineStartIndex,
    lineEndIndex,
    lineVertexArray,
    labelPlaneMatrix,
    projectionCache,
    returnTileDistance
  );
  if (!firstPlacedGlyph) return null;

  const lastPlacedGlyph = placeGlyphAlongLine(
    fontScale * lastGlyphOffset,
    lineOffsetX,
    lineOffsetY,
    flip,
    anchorPoint,
    tileAnchorPoint,
    symbol.segment,
    lineStartIndex,
    lineEndIndex,
    lineVertexArray,
    labelPlaneMatrix,
    projectionCache,
    returnTileDistance
  );
  if (!lastPlacedGlyph) return null;

  return { first: firstPlacedGlyph, last: lastPlacedGlyph };
}

function requiresOrientationChange(writingMode, firstPoint, lastPoint, aspectRatio) {
  if (writingMode === WritingMode.horizontal) {
    // On top of choosing whether to flip, choose whether to render this version of the glyphs or the alternate
    // vertical glyphs. We can't just filter out vertical glyphs in the horizontal range because the horizontal
    // and vertical versions can have slightly different projections which could lead to angles where both or
    // neither showed.
    const rise = Math.abs(lastPoint.y - firstPoint.y);
    const run = Math.abs(lastPoint.x - firstPoint.x) * aspectRatio;
    if (rise > run) {
      return { useVertical: true };
    }
  }

  if (writingMode === WritingMode.vertical ? firstPoint.y < lastPoint.y : firstPoint.x > lastPoint.x) {
    // Includes "horizontalOnly" case for labels without vertical glyphs
    return { needsFlipping: true };
  }

  return null;
}

function placeGlyphsAlongLine(
  symbol,
  fontSize,
  flip,
  keepUpright,
  posMatrix,
  labelPlaneMatrix,
  glCoordMatrix,
  glyphOffsetArray,
  lineVertexArray,
  dynamicLayoutVertexArray,
  anchorPoint,
  tileAnchorPoint,
  projectionCache,
  aspectRatio
) {
  const fontScale = fontSize / 24;
  const lineOffsetX = symbol.lineOffsetX * fontSize;
  const lineOffsetY = symbol.lineOffsetY * fontSize;

  let placedGlyphs;
  if (symbol.numGlyphs > 1) {
    const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;
    const lineStartIndex = symbol.lineStartIndex;
    const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;

    // Place the first and the last glyph in the label first, so we can figure out
    // the overall orientation of the label and determine whether it needs to be flipped in keepUpright mode
    const firstAndLastGlyph = placeFirstAndLastGlyph(
      fontScale,
      glyphOffsetArray,
      lineOffsetX,
      lineOffsetY,
      flip,
      anchorPoint,
      tileAnchorPoint,
      symbol,
      lineVertexArray,
      labelPlaneMatrix,
      projectionCache,
      false
    );
    if (!firstAndLastGlyph) {
      return { notEnoughRoom: true };
    }
    const firstPoint = project(firstAndLastGlyph.first.point, glCoordMatrix).point;
    const lastPoint = project(firstAndLastGlyph.last.point, glCoordMatrix).point;

    if (keepUpright && !flip) {
      const orientationChange = requiresOrientationChange(symbol.writingMode, firstPoint, lastPoint, aspectRatio);
      if (orientationChange) {
        return orientationChange;
      }
    }

    placedGlyphs = [firstAndLastGlyph.first];
    for (let glyphIndex = symbol.glyphStartIndex + 1; glyphIndex < glyphEndIndex - 1; glyphIndex++) {
      // Since first and last glyph fit on the line, we're sure that the rest of the glyphs can be placed
      // $FlowFixMe
      placedGlyphs.push(
        placeGlyphAlongLine(
          fontScale * glyphOffsetArray.getoffsetX(glyphIndex),
          lineOffsetX,
          lineOffsetY,
          flip,
          anchorPoint,
          tileAnchorPoint,
          symbol.segment,
          lineStartIndex,
          lineEndIndex,
          lineVertexArray,
          labelPlaneMatrix,
          projectionCache,
          false
        )
      );
    }
    placedGlyphs.push(firstAndLastGlyph.last);
  } else {
    // Only a single glyph to place
    // So, determine whether to flip based on projected angle of the line segment it's on
    if (keepUpright && !flip) {
      const a = project(tileAnchorPoint, posMatrix).point;
      const tileVertexIndex = symbol.lineStartIndex + symbol.segment + 1;
      // $FlowFixMe
      const tileSegmentEnd = new Point(lineVertexArray.getx(tileVertexIndex), lineVertexArray.gety(tileVertexIndex));
      const projectedVertex = project(tileSegmentEnd, posMatrix);
      // We know the anchor will be in the viewport, but the end of the line segment may be
      // behind the plane of the camera, in which case we can use a point at any arbitrary (closer)
      // point on the segment.
      const b =
        projectedVertex.signedDistanceFromCamera > 0
          ? projectedVertex.point
          : projectTruncatedLineSegment(tileAnchorPoint, tileSegmentEnd, a, 1, posMatrix);

      const orientationChange = requiresOrientationChange(symbol.writingMode, a, b, aspectRatio);
      if (orientationChange) {
        return orientationChange;
      }
    }
    // $FlowFixMe
    const singleGlyph = placeGlyphAlongLine(
      fontScale * glyphOffsetArray.getoffsetX(symbol.glyphStartIndex),
      lineOffsetX,
      lineOffsetY,
      flip,
      anchorPoint,
      tileAnchorPoint,
      symbol.segment,
      symbol.lineStartIndex,
      symbol.lineStartIndex + symbol.lineLength,
      lineVertexArray,
      labelPlaneMatrix,
      projectionCache,
      false
    );
    if (!singleGlyph) return { notEnoughRoom: true };

    placedGlyphs = [singleGlyph];
  }

  for (const glyph of placedGlyphs) {
    addDynamicAttributes(dynamicLayoutVertexArray, glyph.point, glyph.angle);
  }
  return {};
}

function projectTruncatedLineSegment(
  previousTilePoint,
  currentTilePoint,
  previousProjectedPoint,
  minimumLength,
  projectionMatrix
) {
  // We are assuming "previousTilePoint" won't project to a point within one unit of the camera plane
  // If it did, that would mean our label extended all the way out from within the viewport to a (very distant)
  // point near the plane of the camera. We wouldn't be able to render the label anyway once it crossed the
  // plane of the camera.
  const projectedUnitVertex = project(
    previousTilePoint.add(previousTilePoint.sub(currentTilePoint)._unit()),
    projectionMatrix
  ).point;
  const projectedUnitSegment = previousProjectedPoint.sub(projectedUnitVertex);

  return previousProjectedPoint.add(projectedUnitSegment._mult(minimumLength / projectedUnitSegment.mag()));
}

function placeGlyphAlongLine(
  offsetX,
  lineOffsetX,
  lineOffsetY,
  flip,
  anchorPoint,
  tileAnchorPoint,
  anchorSegment,
  lineStartIndex,
  lineEndIndex,
  lineVertexArray,
  labelPlaneMatrix,
  projectionCache,
  returnTileDistance
) {
  const combinedOffsetX = flip ? offsetX - lineOffsetX : offsetX + lineOffsetX;

  let dir = combinedOffsetX > 0 ? 1 : -1;

  let angle = 0;
  if (flip) {
    // The label needs to be flipped to keep text upright.
    // Iterate in the reverse direction.
    dir *= -1;
    angle = Math.PI;
  }

  if (dir < 0) angle += Math.PI;

  let currentIndex = dir > 0 ? lineStartIndex + anchorSegment : lineStartIndex + anchorSegment + 1;

  const initialIndex = currentIndex;
  let current = anchorPoint;
  let prev = anchorPoint;
  let distanceToPrev = 0;
  let currentSegmentDistance = 0;
  const absOffsetX = Math.abs(combinedOffsetX);

  while (distanceToPrev + currentSegmentDistance <= absOffsetX) {
    currentIndex += dir;

    // offset does not fit on the projected line
    if (currentIndex < lineStartIndex || currentIndex >= lineEndIndex) return null;

    prev = current;

    current = projectionCache[currentIndex];
    if (current === undefined) {
      const currentVertex = new Point(lineVertexArray.getx(currentIndex), lineVertexArray.gety(currentIndex));
      const projection = project(currentVertex, labelPlaneMatrix);
      if (projection.signedDistanceFromCamera > 0) {
        current = projectionCache[currentIndex] = projection.point;
      } else {
        // The vertex is behind the plane of the camera, so we can't project it
        // Instead, we'll create a vertex along the line that's far enough to include the glyph
        const previousLineVertexIndex = currentIndex - dir;
        const previousTilePoint =
          distanceToPrev === 0
            ? tileAnchorPoint
            : new Point(lineVertexArray.getx(previousLineVertexIndex), lineVertexArray.gety(previousLineVertexIndex));
        // Don't cache because the new vertex might not be far enough out for future glyphs on the same segment
        current = projectTruncatedLineSegment(
          previousTilePoint,
          currentVertex,
          prev,
          absOffsetX - distanceToPrev + 1,
          labelPlaneMatrix
        );
      }
    }

    distanceToPrev += currentSegmentDistance;
    currentSegmentDistance = prev.dist(current);
  }

  // The point is on the current segment. Interpolate to find it.
  const segmentInterpolationT = (absOffsetX - distanceToPrev) / currentSegmentDistance;
  const prevToCurrent = current.sub(prev);
  const p = prevToCurrent.mult(segmentInterpolationT)._add(prev);

  // offset the point from the line to text-offset and icon-offset
  p._add(
    prevToCurrent
      ._unit()
      ._perp()
      ._mult(lineOffsetY * dir)
  );

  const segmentAngle = angle + Math.atan2(current.y - prev.y, current.x - prev.x);

  return {
    point: p,
    angle: segmentAngle,
    tileDistance: returnTileDistance
      ? {
          prevTileDistance:
            currentIndex - dir === initialIndex ? 0 : lineVertexArray.gettileUnitDistanceFromAnchor(currentIndex - dir),
          lastSegmentViewportDistance: absOffsetX - distanceToPrev
        }
      : null
  };
}

const hiddenGlyphAttributes = new Float32Array([
  Number.NEGATIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  0,
  Number.NEGATIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  0,
  Number.NEGATIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  0,
  Number.NEGATIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  0
]);

// Hide them by moving them offscreen. We still need to add them to the buffer
// because the dynamic buffer is paired with a static buffer that doesn't get updated.
function hideGlyphs(num, dynamicLayoutVertexArray) {
  for (let i = 0; i < num; i++) {
    const offset = dynamicLayoutVertexArray.length;
    dynamicLayoutVertexArray.resize(offset + 4);
    // Since all hidden glyphs have the same attributes, we can build up the array faster with a single call to Float32Array.set
    // for each set of four vertices, instead of calling addDynamicAttributes for each vertex.
    dynamicLayoutVertexArray.float32.set(hiddenGlyphAttributes, offset * 3);
  }
}

// For line label layout, we're not using z output and our w input is always 1
// This custom matrix transformation ignores those components to make projection faster
function xyTransformMat4(out, a, m) {
  const x = a[0];
  const y = a[1];
  out[0] = m[0] * x + m[4] * y + m[12];
  out[1] = m[1] * x + m[5] * y + m[13];
  out[3] = m[3] * x + m[7] * y + m[15];
  return out;
}
