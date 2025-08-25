import glMatrix from '@mapbox/gl-matrix';
import pixelsToTileUnits from '../../source/pixels_to_tile_units.js';
import { Uniform1f, Uniform1i, Uniform2f, UniformMatrix4f } from '../uniform_binding.js';

const { mat4 } = glMatrix;

export const heatmapUniforms = (context, locations) => ({
  u_extrude_scale: new Uniform1f(context, locations.u_extrude_scale),
  u_intensity: new Uniform1f(context, locations.u_intensity),
  u_matrix: new UniformMatrix4f(context, locations.u_matrix)
});

export const heatmapTextureUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_world: new Uniform2f(context, locations.u_world),
  u_image: new Uniform1i(context, locations.u_image),
  u_color_ramp: new Uniform1i(context, locations.u_color_ramp),
  u_opacity: new Uniform1f(context, locations.u_opacity)
});

export const heatmapUniformValues = (matrix, tile, zoom, intensity) => ({
  u_matrix: matrix,
  u_extrude_scale: pixelsToTileUnits(tile, 1, zoom),
  u_intensity: intensity
});

export const heatmapTextureUniformValues = (painter, layer, textureUnit, colorRampUnit) => {
  const matrix = mat4.create();
  mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);

  const gl = painter.context.gl;

  return {
    u_matrix: matrix,
    u_world: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    u_image: textureUnit,
    u_color_ramp: colorRampUnit,
    u_opacity: layer._paint.get('heatmap-opacity')
  };
};
