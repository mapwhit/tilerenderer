const { bindAll } = require('../util/object');

/**
 * The `Source` interface must be implemented by each source type, including "core" types (`vector`, `raster`,
 * `video`, etc.) and all custom, third-party types.
 *
 * @private
 *
 * @param {string} id The id for the source. Must not be used by any existing source.
 * @param {Object} options Source options, specific to the source type (except for `options.type`, which is always
 * required).
 * @param {string} options.type The source type, matching the value of `name` used in {@link Style#addSourceType}.
 *
 * @fires data with `{dataType: 'source', sourceDataType: 'metadata'}` to indicate that any necessary metadata
 * has been loaded so that it's okay to call `loadTile`; and with `{dataType: 'source', sourceDataType: 'content'}`
 * to indicate that the source data has changed, so that any current caches should be flushed.
 * @property {string} id The id for the source.  Must match the id passed to the constructor.
 * @property {number} minzoom
 * @property {number} maxzoom
 * @property {boolean} isTileClipped `false` if tiles can be drawn outside their boundaries, `true` if they cannot.
 * @property {boolean} reparseOverscaled `true` if tiles should be sent back to the worker for each overzoomed zoom
 * level, `false` if not.
 * @property {boolean} roundZoom `true` if zoom levels are rounded to the nearest integer in the source data, `false`
 * if they are floor-ed to the nearest integer.
 */

const vector = require('./vector_tile_source');
const raster = require('./raster_tile_source');
const rasterDem = require('./raster_dem_tile_source');
const geojson = require('./geojson_source');
const image = require('./image_source');

const sourceTypes = {
  vector,
  raster,
  'raster-dem': rasterDem,
  geojson,
  image
};

/*
 * Creates a tiled data source instance given an options object.
 *
 * @param id
 * @param {Object} source A source definition object compliant with
 * [`mapbox-gl-style-spec`](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or, for a third-party source type,
 * with that type's requirements.
 * @returns {Source}
 */
function create(id, specification, eventedParent, { resources, layerIndex }) {
  const source = new sourceTypes[specification.type](id, specification, eventedParent, { resources, layerIndex });

  bindAll(['load', 'abort', 'unload', 'serialize', 'prepare'], source);
  return source;
}

function getType(name) {
  return sourceTypes[name];
}

function setType(name, type) {
  sourceTypes[name] = type;
}

module.exports = {
  create,
  getType,
  setType
};
