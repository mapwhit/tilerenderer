import UnitBezier from '@mapbox/unitbezier';

/**
 * @module util
 * @private
 */

/**
 * Given a value `t` that varies between 0 and 1, return
 * an interpolation function that eases between 0 and 1 in a pleasing
 * cubic in-out fashion.
 *
 * @private
 */
export function easeCubicInOut(t) {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  const t2 = t * t;
  const t3 = t2 * t;
  return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}

/**
 * Given given (x, y), (x1, y1) control points for a bezier curve,
 * return a function that interpolates along that curve.
 *
 * @param p1x control point 1 x coordinate
 * @param p1y control point 1 y coordinate
 * @param p2x control point 2 x coordinate
 * @param p2y control point 2 y coordinate
 * @private
 */
export function bezier(p1x, p1y, p2x, p2y) {
  const bezier = new UnitBezier(p1x, p1y, p2x, p2y);
  return function (t) {
    return bezier.solve(t);
  };
}

/**
 * A default bezier-curve powered easing function with
 * control points (0.25, 0.1) and (0.25, 1)
 *
 * @private
 */
export const ease = bezier(0.25, 0.1, 0.25, 1);

/**
 * constrain n to the given range via min + max
 *
 * @param n value
 * @param min the minimum value to be returned
 * @param max the maximum value to be returned
 * @returns the clamped value
 * @private
 */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * constrain n to the given range, excluding the minimum, via modular arithmetic
 *
 * @param n value
 * @param min the minimum value to be returned, exclusive
 * @param max the maximum value to be returned, inclusive
 * @returns constrained number
 * @private
 */
export function wrap(n, min, max) {
  const d = max - min;
  const w = ((((n - min) % d) + d) % d) + min;
  return w === min ? max : w;
}

/**
 * Converts spherical coordinates to cartesian coordinates.
 *
 * @private
 * @param spherical Spherical coordinates, in [radial, azimuthal, polar]
 * @return cartesian coordinates in [x, y, z]
 */

export function sphericalToCartesian([r, azimuthal, polar]) {
  // We abstract "north"/"up" (compass-wise) to be 0° when really this is 90° (π/2):
  // correct for that here
  azimuthal += 90;

  // Convert azimuthal and polar angles to radians
  azimuthal *= Math.PI / 180;
  polar *= Math.PI / 180;

  return {
    x: r * Math.cos(azimuthal) * Math.sin(polar),
    y: r * Math.sin(azimuthal) * Math.sin(polar),
    z: r * Math.cos(polar)
  };
}
