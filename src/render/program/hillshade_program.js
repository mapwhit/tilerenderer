const assert = require('assert');
const { mat4 } = require('@mapbox/gl-matrix');

const { Uniform1i, Uniform1f, Uniform2f, UniformColor, UniformMatrix4f } = require('../uniform_binding');
const EXTENT = require('../../data/extent');
const Coordinate = require('../../geo/coordinate');

const hillshadeUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_image: new Uniform1i(context, locations.u_image),
  u_latrange: new Uniform2f(context, locations.u_latrange),
  u_light: new Uniform2f(context, locations.u_light),
  u_shadow: new UniformColor(context, locations.u_shadow),
  u_highlight: new UniformColor(context, locations.u_highlight),
  u_accent: new UniformColor(context, locations.u_accent)
});

const hillshadePrepareUniforms = (context, locations) => ({
  u_matrix: new UniformMatrix4f(context, locations.u_matrix),
  u_image: new Uniform1i(context, locations.u_image),
  u_dimension: new Uniform2f(context, locations.u_dimension),
  u_zoom: new Uniform1f(context, locations.u_zoom),
  u_maxzoom: new Uniform1f(context, locations.u_maxzoom)
});

const hillshadeUniformValues = (painter, tile, layer) => {
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

const hillshadeUniformPrepareValues = (tile, maxzoom) => {
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
  const coordinate0 = tileID.toCoordinate();
  const coordinate1 = new Coordinate(coordinate0.column, coordinate0.row + 1, coordinate0.zoom);
  return [painter.transform.coordinateLocation(coordinate0).lat, painter.transform.coordinateLocation(coordinate1).lat];
}

module.exports = {
  hillshadeUniforms,
  hillshadePrepareUniforms,
  hillshadeUniformValues,
  hillshadeUniformPrepareValues
};
