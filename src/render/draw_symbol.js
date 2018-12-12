import glMatrix from '@mapbox/gl-matrix';
import SegmentVector from '../data/segment.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import properties from '../style/style_layer/symbol_style_layer_properties.js';
import * as symbolProjection from '../symbol/projection.js';
import * as symbolSize from '../symbol/symbol_size.js';
import drawCollisionDebug from './draw_collision_debug.js';
import { symbolIconUniformValues, symbolSDFUniformValues } from './program/symbol_program.js';

const { mat4 } = glMatrix;
const identityMat4 = mat4.identity(new Float32Array(16));
const symbolLayoutProperties = properties.layout;

export default function drawSymbols(painter, sourceCache, layer, coords) {
  if (painter.renderPass !== 'translucent') {
    return;
  }

  // Disable the stencil test so that labels aren't clipped to tile boundaries.
  const stencilMode = StencilMode.disabled;
  const colorMode = painter.colorModeForRenderPass();

  if (layer._paint.get('icon-opacity').constantOr(1) !== 0) {
    drawLayerSymbols(
      painter,
      sourceCache,
      layer,
      coords,
      false,
      layer._paint.get('icon-translate'),
      layer._paint.get('icon-translate-anchor'),
      layer._layout.get('icon-rotation-alignment'),
      layer._layout.get('icon-pitch-alignment'),
      layer._layout.get('icon-keep-upright'),
      stencilMode,
      colorMode
    );
  }

  if (layer._paint.get('text-opacity').constantOr(1) !== 0) {
    drawLayerSymbols(
      painter,
      sourceCache,
      layer,
      coords,
      true,
      layer._paint.get('text-translate'),
      layer._paint.get('text-translate-anchor'),
      layer._layout.get('text-rotation-alignment'),
      layer._layout.get('text-pitch-alignment'),
      layer._layout.get('text-keep-upright'),
      stencilMode,
      colorMode
    );
  }

  if (sourceCache.map.showCollisionBoxes) {
    drawCollisionDebug(painter, sourceCache, layer, coords);
  }
}

function drawLayerSymbols(
  painter,
  sourceCache,
  layer,
  coords,
  isText,
  translate,
  translateAnchor,
  rotationAlignment,
  pitchAlignment,
  keepUpright,
  stencilMode,
  colorMode
) {
  const context = painter.context;
  const gl = context.gl;
  const tr = painter.transform;

  const rotateWithMap = rotationAlignment === 'map';
  const pitchWithMap = pitchAlignment === 'map';
  const alongLine = rotateWithMap && layer._layout.get('symbol-placement') !== 'point';
  // Line label rotation happens in `updateLineLabels`
  // Pitched point labels are automatically rotated by the labelPlaneMatrix projection
  // Unpitched point labels need to have their rotation applied after projection
  const rotateInShader = rotateWithMap && !pitchWithMap && !alongLine;

  const sortFeaturesByKey = layer._layout.get('symbol-sort-key').constantOr(1) !== undefined;

  const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);

  let program;
  let size;

  const tileRenderState = [];

  for (const coord of coords) {
    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) {
      continue;
    }
    const buffers = isText ? bucket.text : bucket.icon;
    if (!buffers || !buffers.segments.get().length) {
      continue;
    }
    const programConfiguration = buffers.programConfigurations.get(layer.id);

    const isSDF = isText || bucket.sdfIcons;

    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;

    if (!program) {
      program = painter.useProgram(isSDF ? 'symbolSDF' : 'symbolIcon', programConfiguration);
      size = symbolSize.evaluateSizeForZoom(
        sizeData,
        tr.zoom,
        symbolLayoutProperties.properties[isText ? 'text-size' : 'icon-size']
      );
    }

    context.activeTexture.set(gl.TEXTURE0);

    let texSize;
    let atlasTexture;
    let atlasInterpolation;
    if (isText) {
      atlasTexture = tile.glyphAtlasTexture;
      atlasInterpolation = gl.LINEAR;
      texSize = tile.glyphAtlasTexture.size;
    } else {
      const iconScaled = layer._layout.get('icon-size').constantOr(0) !== 1 || bucket.iconsNeedLinear;
      const iconTransformed = pitchWithMap || tr.pitch !== 0;

      atlasTexture = tile.imageAtlasTexture;
      atlasInterpolation =
        isSDF || painter.options.rotating || painter.options.zooming || iconScaled || iconTransformed
          ? gl.LINEAR
          : gl.NEAREST;
      texSize = tile.imageAtlasTexture.size;
    }

    const s = pixelsToTileUnits(tile, 1, painter.transform.zoom);
    const labelPlaneMatrix = symbolProjection.getLabelPlaneMatrix(
      coord.posMatrix,
      pitchWithMap,
      rotateWithMap,
      painter.transform,
      s
    );
    const glCoordMatrix = symbolProjection.getGlCoordMatrix(
      coord.posMatrix,
      pitchWithMap,
      rotateWithMap,
      painter.transform,
      s
    );

    if (alongLine) {
      symbolProjection.updateLineLabels(
        bucket,
        coord.posMatrix,
        painter,
        isText,
        labelPlaneMatrix,
        glCoordMatrix,
        pitchWithMap,
        keepUpright
      );
    }

    const matrix = painter.translatePosMatrix(coord.posMatrix, tile, translate, translateAnchor);
    const uLabelPlaneMatrix = alongLine ? identityMat4 : labelPlaneMatrix;
    const uglCoordMatrix = painter.translatePosMatrix(glCoordMatrix, tile, translate, translateAnchor, true);

    const hasHalo = isSDF && layer._paint.get(isText ? 'text-halo-width' : 'icon-halo-width').constantOr(1) !== 0;

    let uniformValues;
    if (isSDF) {
      uniformValues = symbolSDFUniformValues(
        sizeData.functionType,
        size,
        rotateInShader,
        pitchWithMap,
        painter,
        matrix,
        uLabelPlaneMatrix,
        uglCoordMatrix,
        isText,
        texSize,
        true
      );
    } else {
      uniformValues = symbolIconUniformValues(
        sizeData.functionType,
        size,
        rotateInShader,
        pitchWithMap,
        painter,
        matrix,
        uLabelPlaneMatrix,
        uglCoordMatrix,
        isText,
        texSize
      );
    }

    const state = {
      program,
      buffers,
      uniformValues,
      atlasTexture,
      atlasInterpolation,
      isSDF,
      hasHalo
    };

    if (sortFeaturesByKey) {
      const oldSegments = buffers.segments.get();
      for (const segment of oldSegments) {
        tileRenderState.push({
          segments: new SegmentVector([segment]),
          sortKey: segment.sortKey,
          state
        });
      }
    } else {
      tileRenderState.push({
        segments: buffers.segments,
        sortKey: 0,
        state
      });
    }
  }

  if (sortFeaturesByKey) {
    tileRenderState.sort((a, b) => a.sortKey - b.sortKey);
  }

  for (const segmentState of tileRenderState) {
    const state = segmentState.state;

    state.atlasTexture.bind(state.atlasInterpolation, gl.CLAMP_TO_EDGE);

    if (state.isSDF) {
      const uniformValues = state.uniformValues;
      if (state.hasHalo) {
        uniformValues['u_is_halo'] = 1;
        drawSymbolElements(
          state.buffers,
          segmentState.segments,
          layer,
          painter,
          state.program,
          depthMode,
          stencilMode,
          colorMode,
          uniformValues
        );
      }
      uniformValues['u_is_halo'] = 0;
    }
    drawSymbolElements(
      state.buffers,
      segmentState.segments,
      layer,
      painter,
      state.program,
      depthMode,
      stencilMode,
      colorMode,
      state.uniformValues
    );
  }
}

function drawSymbolElements(
  buffers,
  segments,
  layer,
  painter,
  program,
  depthMode,
  stencilMode,
  colorMode,
  uniformValues
) {
  const context = painter.context;
  const gl = context.gl;
  program.draw(
    context,
    gl.TRIANGLES,
    depthMode,
    stencilMode,
    colorMode,
    CullFaceMode.disabled,
    uniformValues,
    layer.id,
    buffers.layoutVertexBuffer,
    buffers.indexBuffer,
    segments,
    layer._paint,
    painter.transform.zoom,
    buffers.programConfigurations.get(layer.id),
    buffers.dynamicLayoutVertexBuffer,
    buffers.opacityVertexBuffer
  );
}
