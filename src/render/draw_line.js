import CullFaceMode from '../gl/cull_face_mode.js';
import DepthMode from '../gl/depth_mode.js';
import {
  lineGradientUniformValues,
  linePatternUniformValues,
  lineSDFUniformValues,
  lineUniformValues
} from './program/line_program.js';
import Texture from './texture.js';

export default function drawLine(painter, sourceCache, layer, coords) {
  if (painter.renderPass !== 'translucent') return;

  const opacity = layer._paint.get('line-opacity');
  const width = layer._paint.get('line-width');
  if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

  const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
  const colorMode = painter.colorModeForRenderPass();

  const dasharray = layer._paint.get('line-dasharray');
  const patternProperty = layer._paint.get('line-pattern');
  const image = patternProperty.constantOr(1);
  const gradient = layer._paint.get('line-gradient');
  const crossfade = layer.getCrossfadeParameters();

  const programId = dasharray ? 'lineSDF' : image ? 'linePattern' : gradient ? 'lineGradient' : 'line';

  const context = painter.context;
  const gl = context.gl;

  let firstTile = true;

  if (gradient) {
    context.activeTexture.set(gl.TEXTURE0);

    let gradientTexture = layer.gradientTexture;
    if (!layer.gradient) return;
    if (!gradientTexture) gradientTexture = layer.gradientTexture = new Texture(context, layer.gradient, gl.RGBA);
    gradientTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
  }

  for (const coord of coords) {
    const tile = sourceCache.getTile(coord);

    if (image && !tile.patternsLoaded()) continue;

    const bucket = tile.getBucket(layer);
    if (!bucket) continue;

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const prevProgram = painter.context.program.get();
    const program = painter.useProgram(programId, programConfiguration);
    const programChanged = firstTile || program.program !== prevProgram;

    const constantPattern = patternProperty.constantOr(null);
    if (constantPattern && tile.imageAtlas) {
      const posTo = tile.imageAtlas.patternPositions[constantPattern.to];
      const posFrom = tile.imageAtlas.patternPositions[constantPattern.from];
      if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
    }

    const uniformValues = dasharray
      ? lineSDFUniformValues(painter, tile, layer, dasharray, crossfade)
      : image
        ? linePatternUniformValues(painter, tile, layer, crossfade)
        : gradient
          ? lineGradientUniformValues(painter, tile, layer)
          : lineUniformValues(painter, tile, layer);

    if (dasharray && (programChanged || painter.lineAtlas.dirty)) {
      context.activeTexture.set(gl.TEXTURE0);
      painter.lineAtlas.bind(context);
    } else if (image) {
      tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
      programConfiguration.updatePatternPaintBuffers(crossfade);
    }

    program.draw(
      context,
      gl.TRIANGLES,
      depthMode,
      painter.stencilModeForClipping(coord),
      colorMode,
      CullFaceMode.disabled,
      uniformValues,
      layer.id,
      bucket.layoutVertexBuffer,
      bucket.indexBuffer,
      bucket.segments,
      layer._paint,
      painter.transform.zoom,
      programConfiguration
    );

    firstTile = false;
    // once refactored so that bound texture state is managed, we'll also be able to remove this firstTile/programChanged logic
  }
}
