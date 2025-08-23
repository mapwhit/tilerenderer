import CullFaceMode from '../gl/cull_face_mode.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import { circleUniformValues } from './program/circle_program.js';
export default drawCircles;

function drawCircles(painter, sourceCache, layer, coords) {
  if (painter.renderPass !== 'translucent') return;

  const opacity = layer._paint.get('circle-opacity');
  const strokeWidth = layer._paint.get('circle-stroke-width');
  const strokeOpacity = layer._paint.get('circle-stroke-opacity');

  if (opacity.constantOr(1) === 0 && (strokeWidth.constantOr(1) === 0 || strokeOpacity.constantOr(1) === 0)) {
    return;
  }

  const context = painter.context;
  const gl = context.gl;

  const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
  // Turn off stencil testing to allow circles to be drawn across boundaries,
  // so that large circles are not clipped to tiles
  const stencilMode = StencilMode.disabled;
  const colorMode = painter.colorModeForRenderPass();

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];

    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) continue;

    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const program = painter.useProgram('circle', programConfiguration);

    program.draw(
      context,
      gl.TRIANGLES,
      depthMode,
      stencilMode,
      colorMode,
      CullFaceMode.disabled,
      circleUniformValues(painter, coord, tile, layer),
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
