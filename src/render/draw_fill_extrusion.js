const DepthMode = require('../gl/depth_mode');
const StencilMode = require('../gl/stencil_mode');
const ColorMode = require('../gl/color_mode');
const CullFaceMode = require('../gl/cull_face_mode');
const { fillExtrusionUniformValues, fillExtrusionPatternUniformValues } = require('./program/fill_extrusion_program');

module.exports = draw;

function draw(painter, source, layer, coords) {
  const opacity = layer._paint.get('fill-extrusion-opacity');
  if (opacity === 0) {
    return;
  }

  if (painter.renderPass === 'translucent') {
    const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

    if (opacity === 1 && !layer._paint.get('fill-extrusion-pattern').constantOr(1)) {
      const colorMode = painter.colorModeForRenderPass();
      drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, colorMode);
    } else {
      // Draw transparent buildings in two passes so that only the closest surface is drawn.
      // First draw all the extrusions into only the depth buffer. No colors are drawn.
      drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, ColorMode.disabled);

      // Then draw all the extrusions a second type, only coloring fragments if they have the
      // same depth value as the closest fragment in the previous pass. Use the stencil buffer
      // to prevent the second draw in cases where we have coincident polygons.
      drawExtrusionTiles(
        painter,
        source,
        layer,
        coords,
        depthMode,
        painter.stencilModeFor3D(),
        painter.colorModeForRenderPass()
      );
    }
  }
}

function drawExtrusionTiles(painter, source, layer, coords, depthMode, stencilMode, colorMode) {
  const context = painter.context;
  const gl = context.gl;

  const patternProperty = layer._paint.get('fill-extrusion-pattern');
  const image = patternProperty.constantOr(1);
  const crossfade = layer.getCrossfadeParameters();
  const opacity = layer._paint.get('fill-extrusion-opacity');

  for (const coord of coords) {
    const tile = source.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) continue;

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);

    if (image) {
      painter.context.activeTexture.set(gl.TEXTURE0);
      tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
      programConfiguration.updatePatternPaintBuffers(crossfade);
    }

    const constantPattern = patternProperty.constantOr(null);
    if (constantPattern && tile.imageAtlas) {
      const posTo = tile.imageAtlas.patternPositions[constantPattern.to];
      const posFrom = tile.imageAtlas.patternPositions[constantPattern.from];
      if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
    }

    const matrix = painter.translatePosMatrix(
      coord.posMatrix,
      tile,
      layer._paint.get('fill-extrusion-translate'),
      layer._paint.get('fill-extrusion-translate-anchor')
    );

    const shouldUseVerticalGradient = layer._paint.get('fill-extrusion-vertical-gradient');
    const uniformValues = image
      ? fillExtrusionPatternUniformValues(matrix, painter, shouldUseVerticalGradient, opacity, coord, crossfade, tile)
      : fillExtrusionUniformValues(matrix, painter, shouldUseVerticalGradient, opacity);

    program.draw(
      context,
      context.gl.TRIANGLES,
      depthMode,
      stencilMode,
      colorMode,
      CullFaceMode.backCCW,
      uniformValues,
      layer.id,
      bucket.layoutVertexBuffer,
      bucket.indexBuffer,
      bucket.segments,
      layer._paint,
      painter.transform.zoom,
      programConfiguration
    );
  }
}
