import CullFaceMode from '../gl/cull_face_mode.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import { collisionUniformValues } from './program/collision_program.js';
export default drawCollisionDebug;

function drawCollisionDebugGeometry(painter, sourceCache, layer, coords, drawCircles) {
  const context = painter.context;
  const gl = context.gl;
  const program = drawCircles ? painter.useProgram('collisionCircle') : painter.useProgram('collisionBox');

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];
    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) continue;
    const buffers = drawCircles ? bucket.collisionCircle : bucket.collisionBox;
    if (!buffers) continue;

    program.draw(
      context,
      drawCircles ? gl.TRIANGLES : gl.LINES,
      DepthMode.disabled,
      StencilMode.disabled,
      painter.colorModeForRenderPass(),
      CullFaceMode.disabled,
      collisionUniformValues(coord.posMatrix, painter.transform, tile),
      layer.id,
      buffers.layoutVertexBuffer,
      buffers.indexBuffer,
      buffers.segments,
      null,
      painter.transform.zoom,
      null,
      null,
      buffers.collisionVertexBuffer
    );
  }
}

function drawCollisionDebug(painter, sourceCache, layer, coords) {
  drawCollisionDebugGeometry(painter, sourceCache, layer, coords, false);
  drawCollisionDebugGeometry(painter, sourceCache, layer, coords, true);
}
