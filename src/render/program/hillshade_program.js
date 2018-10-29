import glMatrix from '@mapbox/gl-matrix';
import assert from 'assert';
import EXTENT from '../../data/extent.js';
import MercatorCoordinate from '../../geo/mercator_coordinate.js';
import { Uniform1f, Uniform1i, Uniform2f, UniformColor, UniformMatrix4f } from '../uniform_binding.js';

const { mat4 } = glMatrix;

export const hillshadeUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_image: new Uniform1i(context, locations.u_image),
  u_latrange: new Uniform2f(context, locations.u_latrange),
  u_light: new Uniform2f(context, locations.u_light),
  u_shadow: new UniformColor(context, locations.u_shadow),
  u_highlight: new UniformColor(context, locations.u_highlight),
  u_accent: new UniformColor(context, locations.u_accent)
});

export const hillshadePrepareUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_image: new Uniform1i(context, locations.u_image),
  u_dimension: new Uniform2f(context, locations.u_dimension),
  u_zoom: new Uniform1f(context, locations.u_zoom),
  u_maxzoom: new Uniform1f(context, locations.u_maxzoom)
});

export const hillshadeUniformValues = (painter, tile, layer) => {
  const shadow = layer._paint.get('hillshade-shadow-color');
  const highlight = layer._paint.get('hillshade-highlight-color');
  const accent = layer._paint.get('hillshade-accent-color');

  let azimuthal = layer._paint.get('hillshade-illumination-direction') * (Math.PI / 180);
  // modify azimuthal angle by map rotation if light is anchored at the viewport
  if (layer._paint.get('hillshade-illumination-anchor') === 'viewport') {
    azimuthal -= painter.transform.angle;
  }
  const align = !painter.options.moving;
  return {
    u_matrix: painter.transform.calculatePosMatrix(tile.tileID.toUnwrapped(), align),
    u_image: 0,
    u_latrange: getTileLatRange(painter, tile.tileID),
    u_light: [layer._paint.get('hillshade-exaggeration'), azimuthal],
    u_shadow: shadow,
    u_highlight: highlight,
    u_accent: accent
  };
};

export const hillshadeUniformPrepareValues = (tile, maxzoom) => {
  assert(tile.dem);
  const stride = tile.dem.stride;
  const matrix = mat4.create();
  // Flip rendering at y axis.
  mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
  mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

  return {
    u_matrix: matrix,
    u_image: 1,
    u_dimension: [stride, stride],
    u_zoom: tile.tileID.overscaledZ,
    u_maxzoom: maxzoom
  };
};

function getTileLatRange(painter, tileID) {
  // for scaling the magnitude of a points slope by its latitude
  const tilesAtZoom = 2 ** tileID.canonical.z;
  const y = tileID.canonical.y;
  return [
    new MercatorCoordinate(0, y / tilesAtZoom).toLngLat().lat,
    new MercatorCoordinate(0, (y + 1) / tilesAtZoom).toLngLat().lat
  ];
}
