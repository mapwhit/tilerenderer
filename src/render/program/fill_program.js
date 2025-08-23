import { Uniform1f, Uniform1i, Uniform2f, Uniform4f, UniformMatrix4f } from '../uniform_binding.js';
import { patternUniformValues } from './pattern.js';

export const fillUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix)
});

export const fillPatternUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_image: new Uniform1i(context, locations.u_image),
  u_texsize: new Uniform2f(context, locations.u_texsize),
  u_pixel_coord_upper: new Uniform2f(context, locations.u_pixel_coord_upper),
  u_pixel_coord_lower: new Uniform2f(context, locations.u_pixel_coord_lower),
  u_scale: new Uniform4f(context, locations.u_scale),
  u_fade: new Uniform1f(context, locations.u_fade)
});

export const fillOutlineUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_world: new Uniform2f(context, locations.u_world)
});

export const fillOutlinePatternUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_world: new Uniform2f(context, locations.u_world),
  u_image: new Uniform1i(context, locations.u_image),
  u_texsize: new Uniform2f(context, locations.u_texsize),
  u_pixel_coord_upper: new Uniform2f(context, locations.u_pixel_coord_upper),
  u_pixel_coord_lower: new Uniform2f(context, locations.u_pixel_coord_lower),
  u_scale: new Uniform4f(context, locations.u_scale),
  u_fade: new Uniform1f(context, locations.u_fade)
});

export const fillUniformValues = matrix => ({
  u_matrix: matrix
});

export const fillPatternUniformValues = (matrix, painter, crossfade, tile) =>
  Object.assign(fillUniformValues(matrix), patternUniformValues(crossfade, painter, tile));

export const fillOutlineUniformValues = (matrix, drawingBufferSize) => ({
  u_matrix: matrix,
  u_world: drawingBufferSize
});

export const fillOutlinePatternUniformValues = (matrix, painter, crossfade, tile, drawingBufferSize) =>
  Object.assign(fillPatternUniformValues(matrix, painter, crossfade, tile), {
    u_world: drawingBufferSize
  });
