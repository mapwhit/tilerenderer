import { UniformMatrix4f } from '../uniform_binding.js';

export const clippingMaskUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix)
});

export const clippingMaskUniformValues = matrix => ({
  u_matrix: matrix
});
