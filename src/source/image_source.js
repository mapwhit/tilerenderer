import { ErrorEvent, Event, Evented } from '@mapwhit/events';
import { RasterBoundsArray } from '../data/array_types.js';
import EXTENT from '../data/extent.js';
import rasterBoundsAttributes from '../data/raster_bounds_attributes.js';
import SegmentVector from '../data/segment.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import Texture from '../render/texture.js';
import loadImage from '../util/loader/image.js';
import { CanonicalTileID } from './tile_id.js';

/**
 * A data source containing an image.
 * (See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-image) for detailed documentation of options.)
 *
 * @example
 * // add to map
 * map.addSource('some id', {
 *    type: 'image',
 *    url: 'https://www.mapbox.com/images/foo.png',
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ]
 * });
 *
 * // update
 * var mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 * @see [Add an image](https://www.mapbox.com/mapbox-gl-js/example/image-on-a-map/)
 */
class ImageSource extends Evented {
  /**
   * @private
   */
  constructor(id, options, eventedParent) {
    super();
    this.id = id;
    this.coordinates = options.coordinates;

    this.type = 'image';
    this.minzoom = 0;
    this.maxzoom = 22;
    this.tileSize = 512;
    this.tiles = {};

    this.setEventedParent(eventedParent);

    this.options = options;
  }

  async load() {
    this.fire(new Event('dataloading', { dataType: 'source' }));
    this.url = this.options.url;
    try {
      this.image = await loadImage(this.url);
      this._finishLoading();
    } catch (err) {
      this.fire(new ErrorEvent(err));
    }
  }

  _finishLoading() {
    if (this.map) {
      this.setCoordinates(this.coordinates);
      this.fire(new Event('data', { dataType: 'source', sourceDataType: 'metadata' }));
    }
  }

  onAdd(map) {
    this.map = map;
    this.load();
  }

  /**
   * Sets the image's coordinates and re-renders the map.
   *
   * @param {Array<Array<number>>} coordinates Four geographical coordinates,
   *   represented as arrays of longitude and latitude numbers, which define the corners of the image.
   *   The coordinates start at the top left corner of the image and proceed in clockwise order.
   *   They do not have to represent a rectangle.
   * @returns {ImageSource} this
   */
  setCoordinates(coordinates) {
    this.coordinates = coordinates;

    // Calculate which mercator tile is suitable for rendering the video in
    // and create a buffer with the corner coordinates. These coordinates
    // may be outside the tile, because raster tiles aren't clipped when rendering.

    // transform the geo coordinates into (zoom 0) tile space coordinates
    const cornerCoords = coordinates.map(MercatorCoordinate.fromLngLat);

    // Compute the coordinates of the tile we'll use to hold this image's
    // render data
    this.tileID = getCoordinatesCenterTileID(cornerCoords);

    // Constrain min/max zoom to our tile's zoom level in order to force
    // SourceCache to request this tile (no matter what the map's zoom
    // level)
    this.minzoom = this.maxzoom = this.tileID.z;

    // Transform the corner coordinates into the coordinate space of our
    // tile.
    const tileCoords = cornerCoords.map(coord => this.tileID.getTilePoint(coord)._round());

    this._boundsArray = new RasterBoundsArray();
    this._boundsArray.emplaceBack(tileCoords[0].x, tileCoords[0].y, 0, 0);
    this._boundsArray.emplaceBack(tileCoords[1].x, tileCoords[1].y, EXTENT, 0);
    this._boundsArray.emplaceBack(tileCoords[3].x, tileCoords[3].y, 0, EXTENT);
    this._boundsArray.emplaceBack(tileCoords[2].x, tileCoords[2].y, EXTENT, EXTENT);

    if (this.boundsBuffer) {
      this.boundsBuffer.destroy();
      delete this.boundsBuffer;
    }

    this.fire(new Event('data', { dataType: 'source', sourceDataType: 'content' }));
    return this;
  }

  prepare() {
    if (Object.keys(this.tiles).length === 0 || !this.image) {
      return;
    }

    const context = this.map.painter.context;
    const gl = context.gl;

    if (!this.boundsBuffer) {
      this.boundsBuffer = context.createVertexBuffer(this._boundsArray, rasterBoundsAttributes.members);
    }

    if (!this.boundsSegments) {
      this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    if (!this.texture) {
      this.texture = new Texture(context, this.image, gl.RGBA);
      this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    for (const w in this.tiles) {
      const tile = this.tiles[w];
      if (tile.state !== 'loaded') {
        tile.state = 'loaded';
        tile.texture = this.texture;
      }
    }
  }

  loadTile(tile) {
    // We have a single tile -- whoose coordinates are this.tileID -- that
    // covers the image we want to render.  If that's the one being
    // requested, set it up with the image; otherwise, mark the tile as
    // `errored` to indicate that we have no data for it.
    // If the world wraps, we may have multiple "wrapped" copies of the
    // single tile.
    if (this.tileID?.equals(tile.tileID.canonical)) {
      this.tiles[String(tile.tileID.wrap)] = tile;
      tile.buckets = new Map();
    } else {
      tile.state = 'errored';
    }
    return Promise.resolve();
  }

  hasTransition() {
    return false;
  }
}

/**
 * Given a list of coordinates, get their center as a coordinate.
 *
 * @returns centerpoint
 * @private
 */
export function getCoordinatesCenterTileID(coords) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const coord of coords) {
    minX = Math.min(minX, coord.x);
    minY = Math.min(minY, coord.y);
    maxX = Math.max(maxX, coord.x);
    maxY = Math.max(maxY, coord.y);
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const dMax = Math.max(dx, dy);
  const zoom = Math.max(0, Math.floor(-Math.log(dMax) / Math.LN2));
  const tilesAtZoom = 2 ** zoom;

  return new CanonicalTileID(
    zoom,
    Math.floor(((minX + maxX) / 2) * tilesAtZoom),
    Math.floor(((minY + maxY) / 2) * tilesAtZoom)
  );
}

export default ImageSource;
