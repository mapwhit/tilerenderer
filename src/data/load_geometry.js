import warn from '../util/warn.js';
import EXTENT from './extent.js';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain cordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
function createBounds(bits) {
  return {
    min: -1 * 2 ** (bits - 1),
    max: 2 ** (bits - 1) - 1
  };
}

const bounds = createBounds(16);

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @private
 */
export default function loadGeometry(feature) {
  const scale = EXTENT / feature.extent;
  const geometry = feature.loadGeometry();
  for (const ring of geometry) {
    for (const point of ring) {
      // round here because mapbox-gl-native uses integers to represent
      // points and we need to do the same to avoid renering differences.
      point.x = Math.round(point.x * scale);
      point.y = Math.round(point.y * scale);

      if (point.x < bounds.min || point.x > bounds.max || point.y < bounds.min || point.y > bounds.max) {
        warn.once('Geometry exceeds allowed extent, reduce your vector tile buffer size');
      }
    }
  }
  return geometry;
}
