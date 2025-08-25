import LngLatBounds from '../geo/lng_lat_bounds.js';
import { clamp } from '../util/util.js';

class TileBounds {
  constructor(bounds, minzoom = 0, maxzoom = 24) {
    this.bounds = new LngLatBounds(validateBounds(bounds));
    this.minzoom = minzoom;
    this.maxzoom = maxzoom;
  }

  contains({ x, y, z }) {
    const minX = Math.floor(lngX(this.bounds.getWest(), z));
    if (x < minX) {
      return false;
    }
    const maxX = Math.ceil(lngX(this.bounds.getEast(), z));
    if (x >= maxX) {
      return false;
    }
    const minY = Math.floor(latY(this.bounds.getNorth(), z));
    if (y < minY) {
      return false;
    }
    const maxY = Math.ceil(latY(this.bounds.getSouth(), z));
    return y < maxY;
  }
}

function validateBounds(bounds) {
  // make sure the bounds property contains valid longitude and latitudes
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    return [-180, -90, 180, 90];
  }
  return [Math.max(-180, bounds[0]), Math.max(-90, bounds[1]), Math.min(180, bounds[2]), Math.min(90, bounds[3])];
}

function lngX(lng, zoom) {
  return (lng + 180) * (2 ** zoom / 360);
}

function latY(lat, zoom) {
  const f = clamp(Math.sin((Math.PI / 180) * lat), -0.9999, 0.9999);
  const scale = 2 ** zoom / (2 * Math.PI);
  return 2 ** (zoom - 1) + 0.5 * Math.log((1 + f) / (1 - f)) * -scale;
}

export default TileBounds;
