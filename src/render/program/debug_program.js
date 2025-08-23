import { UniformColor, UniformMatrix4f } from '../uniform_binding.js';

export const debugUniforms = (context, locations) => ({
  u_color: new UniformColor(context, locations.u_color),
  u_matrix: new UniformMatrix4f(context, locations.u_matrix)
});

export const debugUniformValues = (matrix, color) => ({
  u_matrix: matrix,
  u_color: color
});
