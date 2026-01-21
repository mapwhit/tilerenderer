import { VectorTileFeature } from '@mapwhit/vector-tile';
import classifyRings from './classify_rings.js';

export default class GeoJSONFeature {
  #vectorTileFeature;
  #geometry;
  #xyz;

  constructor(vectorTileFeature, z, x, y, id) {
    this.type = 'Feature';

    this.#vectorTileFeature = vectorTileFeature;
    this.#xyz = { z, x, y };

    this.properties = vectorTileFeature.properties;
    if (id !== undefined) {
      this.id = id;
    }
  }

  get geometry() {
    this.#geometry ??= toGeoJSONGeometry(this.#vectorTileFeature, this.#xyz);
    return this.#geometry;
  }
}

const invPi = 360 / Math.PI;

function toGeoJSONGeometry(vtf, { x, y, z }) {
  const size = vtf.extent * 2 ** z;
  const scale = 360 / size;
  const x0 = vtf.extent * x;
  const y0 = vtf.extent * y;
  let coords = vtf.loadGeometry();
  let type = VectorTileFeature.types[vtf.type];

  switch (vtf.type) {
    case 1: {
      const points = new Array(coords.length);
      for (let i = 0; i < coords.length; i++) {
        points[i] = coords[i][0];
      }
      coords = points;
      project(coords);
      break;
    }

    case 2:
      for (let i = 0; i < coords.length; i++) {
        project(coords[i]);
      }
      break;

    case 3:
      coords = classifyRings(coords);
      for (let i = 0; i < coords.length; i++) {
        for (let j = 0; j < coords[i].length; j++) {
          project(coords[i][j]);
        }
      }
      break;
  }

  if (coords.length === 1) {
    coords = coords[0];
  } else {
    type = `Multi${type}`;
  }

  return {
    type,
    coordinates: coords
  };

  function project(line) {
    for (let i = 0; i < line.length; i++) {
      const { x, y } = line[i];
      const lon = (x + x0) * scale - 180;
      const y2 = 180 - (y + y0) * scale;
      const lat = invPi * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
      line[i] = [lon, lat];
    }
  }
}
