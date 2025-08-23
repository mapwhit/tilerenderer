import { Uniform1f, Uniform1i, Uniform2f, UniformColor, UniformMatrix4f } from '../uniform_binding.js';
import { bgPatternUniformValues } from './pattern.js';

export const backgroundUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_opacity: new Uniform1f(context, locations.u_opacity),
  u_color: new UniformColor(context, locations.u_color)
});

export const backgroundPatternUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_opacity: new Uniform1f(context, locations.u_opacity),
  u_image: new Uniform1i(context, locations.u_image),
  u_pattern_tl_a: new Uniform2f(context, locations.u_pattern_tl_a),
  u_pattern_br_a: new Uniform2f(context, locations.u_pattern_br_a),
  u_pattern_tl_b: new Uniform2f(context, locations.u_pattern_tl_b),
  u_pattern_br_b: new Uniform2f(context, locations.u_pattern_br_b),
  u_texsize: new Uniform2f(context, locations.u_texsize),
  u_mix: new Uniform1f(context, locations.u_mix),
  u_pattern_size_a: new Uniform2f(context, locations.u_pattern_size_a),
  u_pattern_size_b: new Uniform2f(context, locations.u_pattern_size_b),
  u_scale_a: new Uniform1f(context, locations.u_scale_a),
  u_scale_b: new Uniform1f(context, locations.u_scale_b),
  u_pixel_coord_upper: new Uniform2f(context, locations.u_pixel_coord_upper),
  u_pixel_coord_lower: new Uniform2f(context, locations.u_pixel_coord_lower),
  u_tile_units_to_pixels: new Uniform1f(context, locations.u_tile_units_to_pixels)
});

export const backgroundUniformValues = (matrix, opacity, color) => ({
  u_matrix: matrix,
  u_opacity: opacity,
  u_color: color
});

export const backgroundPatternUniformValues = (matrix, opacity, painter, image, tile, crossfade) =>
  Object.assign(bgPatternUniformValues(image, crossfade, painter, tile), {
    u_matrix: matrix,
    u_opacity: opacity
  });
