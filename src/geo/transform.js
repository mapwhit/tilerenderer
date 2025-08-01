const LngLat = require('./lng_lat');

const { default: Point } = require('@mapbox/point-geometry');
const Coordinate = require('./coordinate');
const { wrap, clamp } = require('../util/util');
const interpolate = require('../util/interpolate');
const tileCover = require('../util/tile_cover');
const { UnwrappedTileID } = require('../source/tile_id');
const EXTENT = require('../data/extent');
const { vec4, mat4, mat2 } = require('@mapbox/gl-matrix');

/**
 * A single transform, generally used for a single tile to be
 * scaled, rotated, and zoomed.
 * @private
 */
class Transform {
  constructor(minZoom, maxZoom, renderWorldCopies) {
    this.tileSize = 512; // constant
    this.maxValidLatitude = 85.051129; // constant

    this._renderWorldCopies = renderWorldCopies === undefined ? true : renderWorldCopies;
    this._minZoom = minZoom || 0;
    this._maxZoom = maxZoom || 22;

    this.latRange = [-this.maxValidLatitude, this.maxValidLatitude];

    this.width = 0;
    this.height = 0;
    this._center = new LngLat(0, 0);
    this.zoom = 0;
    this.angle = 0;
    this._fov = 0.6435011087932844;
    this._pitch = 0;
    this._unmodified = true;
    this._posMatrixCache = {};
    this._alignedPosMatrixCache = {};
  }

  clone() {
    const clone = new Transform(this._minZoom, this._maxZoom, this._renderWorldCopies);
    clone.tileSize = this.tileSize;
    clone.latRange = this.latRange;
    clone.width = this.width;
    clone.height = this.height;
    clone._center = this._center;
    clone.zoom = this.zoom;
    clone.angle = this.angle;
    clone._fov = this._fov;
    clone._pitch = this._pitch;
    clone._unmodified = this._unmodified;
    clone._calcMatrices();
    return clone;
  }

  get minZoom() {
    return this._minZoom;
  }
  set minZoom(zoom) {
    if (this._minZoom === zoom) return;
    this._minZoom = zoom;
    this.zoom = Math.max(this.zoom, zoom);
  }

  get maxZoom() {
    return this._maxZoom;
  }
  set maxZoom(zoom) {
    if (this._maxZoom === zoom) return;
    this._maxZoom = zoom;
    this.zoom = Math.min(this.zoom, zoom);
  }

  get renderWorldCopies() {
    return this._renderWorldCopies;
  }
  set renderWorldCopies(renderWorldCopies) {
    if (renderWorldCopies === undefined) {
      renderWorldCopies = true;
    } else if (renderWorldCopies === null) {
      renderWorldCopies = false;
    }

    this._renderWorldCopies = renderWorldCopies;
  }

  get worldSize() {
    return this.tileSize * this.scale;
  }

  get centerPoint() {
    return this.size._div(2);
  }

  get size() {
    return new Point(this.width, this.height);
  }

  get bearing() {
    return (-this.angle / Math.PI) * 180;
  }
  set bearing(bearing) {
    const b = (-wrap(bearing, -180, 180) * Math.PI) / 180;
    if (this.angle === b) return;
    this._unmodified = false;
    this.angle = b;
    this._calcMatrices();

    // 2x2 matrix for rotating points
    this.rotationMatrix = mat2.create();
    mat2.rotate(this.rotationMatrix, this.rotationMatrix, this.angle);
  }

  get pitch() {
    return (this._pitch / Math.PI) * 180;
  }
  set pitch(pitch) {
    const p = (clamp(pitch, 0, 60) / 180) * Math.PI;
    if (this._pitch === p) return;
    this._unmodified = false;
    this._pitch = p;
    this._calcMatrices();
  }

  get fov() {
    return (this._fov / Math.PI) * 180;
  }
  set fov(fov) {
    fov = Math.max(0.01, Math.min(60, fov));
    if (this._fov === fov) return;
    this._unmodified = false;
    this._fov = (fov / 180) * Math.PI;
    this._calcMatrices();
  }

  get zoom() {
    return this._zoom;
  }
  set zoom(zoom) {
    const z = Math.min(Math.max(zoom, this.minZoom), this.maxZoom);
    if (this._zoom === z) return;
    this._unmodified = false;
    this._zoom = z;
    this.scale = this.zoomScale(z);
    this.tileZoom = Math.floor(z);
    this.zoomFraction = z - this.tileZoom;
    this._constrain();
    this._calcMatrices();
  }

  get center() {
    return this._center;
  }
  set center(center) {
    if (center.lat === this._center.lat && center.lng === this._center.lng) return;
    this._unmodified = false;
    this._center = center;
    this._constrain();
    this._calcMatrices();
  }

  /**
   * Return a zoom level that will cover all tiles the transform
   * @param {Object} options
   * @param {number} options.tileSize
   * @param {boolean} options.roundZoom
   * @returns {number} zoom level
   */
  coveringZoomLevel(options) {
    return (options.roundZoom ? Math.round : Math.floor)(this.zoom + this.scaleZoom(this.tileSize / options.tileSize));
  }

  /**
   * Return any "wrapped" copies of a given tile coordinate that are visible
   * in the current view.
   *
   * @private
   */
  getVisibleUnwrappedCoordinates(tileID) {
    const result = [new UnwrappedTileID(0, tileID)];
    if (this._renderWorldCopies) {
      const utl = this.pointCoordinate(new Point(0, 0), 0);
      const utr = this.pointCoordinate(new Point(this.width, 0), 0);
      const ubl = this.pointCoordinate(new Point(this.width, this.height), 0);
      const ubr = this.pointCoordinate(new Point(0, this.height), 0);
      const w0 = Math.floor(Math.min(utl.column, utr.column, ubl.column, ubr.column));
      const w1 = Math.floor(Math.max(utl.column, utr.column, ubl.column, ubr.column));

      // Add an extra copy of the world on each side to properly render ImageSources and CanvasSources.
      // Both sources draw outside the tile boundaries of the tile that "contains them" so we need
      // to add extra copies on both sides in case offscreen tiles need to draw into on-screen ones.
      const extraWorldCopy = 1;

      for (let w = w0 - extraWorldCopy; w <= w1 + extraWorldCopy; w++) {
        if (w === 0) continue;
        result.push(new UnwrappedTileID(w, tileID));
      }
    }
    return result;
  }

  /**
   * Return all coordinates that could cover this transform for a covering
   * zoom level.
   * @param {Object} options
   * @param {number} options.tileSize
   * @param {number} options.minzoom
   * @param {number} options.maxzoom
   * @param {boolean} options.roundZoom
   * @param {boolean} options.reparseOverscaled
   * @param {boolean} options.renderWorldCopies
   * @returns {Array<Tile>} tiles
   */
  coveringTiles(options) {
    let z = this.coveringZoomLevel(options);
    const actualZ = z;

    if (options.minzoom !== undefined && z < options.minzoom) return [];
    if (options.maxzoom !== undefined && z > options.maxzoom) z = options.maxzoom;

    const centerCoord = this.pointCoordinate(this.centerPoint, z);
    const centerPoint = new Point(centerCoord.column - 0.5, centerCoord.row - 0.5);
    const cornerCoords = [
      this.pointCoordinate(new Point(0, 0), z),
      this.pointCoordinate(new Point(this.width, 0), z),
      this.pointCoordinate(new Point(this.width, this.height), z),
      this.pointCoordinate(new Point(0, this.height), z)
    ];
    return tileCover(z, cornerCoords, options.reparseOverscaled ? actualZ : z, this._renderWorldCopies).sort(
      (a, b) => centerPoint.dist(a.canonical) - centerPoint.dist(b.canonical)
    );
  }

  resize(width, height) {
    this.width = width;
    this.height = height;

    this.pixelsToGLUnits = [2 / width, -2 / height];
    this._constrain();
    this._calcMatrices();
  }

  get unmodified() {
    return this._unmodified;
  }

  zoomScale(zoom) {
    return 2 ** zoom;
  }
  scaleZoom(scale) {
    return Math.log(scale) / Math.LN2;
  }

  project(lnglat) {
    return new Point(this.lngX(lnglat.lng), this.latY(lnglat.lat));
  }

  unproject(point) {
    return new LngLat(this.xLng(point.x), this.yLat(point.y));
  }

  get x() {
    return this.lngX(this.center.lng);
  }
  get y() {
    return this.latY(this.center.lat);
  }

  get point() {
    return new Point(this.x, this.y);
  }

  /**
   * longitude to absolute x coord
   * @returns {number} pixel coordinate
   */
  lngX(lng) {
    return ((180 + lng) * this.worldSize) / 360;
  }
  /**
   * latitude to absolute y coord
   * @returns {number} pixel coordinate
   */
  latY(lat) {
    lat = clamp(lat, -this.maxValidLatitude, this.maxValidLatitude);
    const y = (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    return ((180 - y) * this.worldSize) / 360;
  }

  xLng(x) {
    return (x * 360) / this.worldSize - 180;
  }
  yLat(y) {
    const y2 = 180 - (y * 360) / this.worldSize;
    return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
  }

  setLocationAtPoint(lnglat, point) {
    const translate = this.pointCoordinate(point)._sub(this.pointCoordinate(this.centerPoint));
    this.center = this.coordinateLocation(this.locationCoordinate(lnglat)._sub(translate));
    if (this._renderWorldCopies) {
      this.center = this.center.wrap();
    }
  }

  /**
   * Given a location, return the screen point that corresponds to it
   * @param {LngLat} lnglat location
   * @returns {Point} screen point
   */
  locationPoint(lnglat) {
    return this.coordinatePoint(this.locationCoordinate(lnglat));
  }

  /**
   * Given a point on screen, return its lnglat
   * @param {Point} p screen point
   * @returns {LngLat} lnglat location
   */
  pointLocation(p) {
    return this.coordinateLocation(this.pointCoordinate(p));
  }

  /**
   * Given a geographical lnglat, return an unrounded
   * coordinate that represents it at this transform's zoom level.
   * @param {LngLat} lnglat
   * @returns {Coordinate}
   */
  locationCoordinate(lnglat) {
    return new Coordinate(
      this.lngX(lnglat.lng) / this.tileSize,
      this.latY(lnglat.lat) / this.tileSize,
      this.zoom
    ).zoomTo(this.tileZoom);
  }

  /**
   * Given a Coordinate, return its geographical position.
   * @param {Coordinate} coord
   * @returns {LngLat} lnglat
   */
  coordinateLocation(coord) {
    const zoomedCoord = coord.zoomTo(this.zoom);
    return new LngLat(this.xLng(zoomedCoord.column * this.tileSize), this.yLat(zoomedCoord.row * this.tileSize));
  }

  pointCoordinate(p, zoom) {
    if (zoom === undefined) zoom = this.tileZoom;

    const targetZ = 0;
    // since we don't know the correct projected z value for the point,
    // unproject two points to get a line and then find the point on that
    // line with z=0

    const coord0 = [p.x, p.y, 0, 1];
    const coord1 = [p.x, p.y, 1, 1];

    vec4.transformMat4(coord0, coord0, this.pixelMatrixInverse);
    vec4.transformMat4(coord1, coord1, this.pixelMatrixInverse);

    const w0 = coord0[3];
    const w1 = coord1[3];
    const x0 = coord0[0] / w0;
    const x1 = coord1[0] / w1;
    const y0 = coord0[1] / w0;
    const y1 = coord1[1] / w1;
    const z0 = coord0[2] / w0;
    const z1 = coord1[2] / w1;

    const t = z0 === z1 ? 0 : (targetZ - z0) / (z1 - z0);

    return new Coordinate(
      interpolate(x0, x1, t) / this.tileSize,
      interpolate(y0, y1, t) / this.tileSize,
      this.zoom
    )._zoomTo(zoom);
  }

  /**
   * Given a coordinate, return the screen point that corresponds to it
   * @param {Coordinate} coord
   * @returns {Point} screen point
   */
  coordinatePoint(coord) {
    const zoomedCoord = coord.zoomTo(this.zoom);
    const p = [zoomedCoord.column * this.tileSize, zoomedCoord.row * this.tileSize, 0, 1];
    vec4.transformMat4(p, p, this.pixelMatrix);
    return new Point(p[0] / p[3], p[1] / p[3]);
  }

  /**
   * Calculate the posMatrix that, given a tile coordinate, would be used to display the tile on a map.
   * @param {UnwrappedTileID} unwrappedTileID;
   */
  calculatePosMatrix(unwrappedTileID, aligned = false) {
    const posMatrixKey = unwrappedTileID.key;
    const cache = aligned ? this._alignedPosMatrixCache : this._posMatrixCache;
    if (cache[posMatrixKey]) {
      return cache[posMatrixKey];
    }

    const canonical = unwrappedTileID.canonical;
    const scale = this.worldSize / this.zoomScale(canonical.z);
    const unwrappedX = canonical.x + 2 ** canonical.z * unwrappedTileID.wrap;

    const posMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(posMatrix, posMatrix, [unwrappedX * scale, canonical.y * scale, 0]);
    mat4.scale(posMatrix, posMatrix, [scale / EXTENT, scale / EXTENT, 1]);
    mat4.multiply(posMatrix, aligned ? this.alignedProjMatrix : this.projMatrix, posMatrix);

    cache[posMatrixKey] = new Float32Array(posMatrix);
    return cache[posMatrixKey];
  }

  _constrain() {
    if (!this.center || !this.width || !this.height || this._constraining) return;

    this._constraining = true;

    let minY = -90;
    let maxY = 90;
    let minX = -180;
    let maxX = 180;
    let sy;
    let sx;
    let x2;
    let y2;
    const size = this.size;
    const unmodified = this._unmodified;

    if (this.latRange) {
      const latRange = this.latRange;
      minY = this.latY(latRange[1]);
      maxY = this.latY(latRange[0]);
      sy = maxY - minY < size.y ? size.y / (maxY - minY) : 0;
    }

    if (this.lngRange) {
      const lngRange = this.lngRange;
      minX = this.lngX(lngRange[0]);
      maxX = this.lngX(lngRange[1]);
      sx = maxX - minX < size.x ? size.x / (maxX - minX) : 0;
    }

    // how much the map should scale to fit the screen into given latitude/longitude ranges
    const s = Math.max(sx || 0, sy || 0);

    if (s) {
      this.center = this.unproject(new Point(sx ? (maxX + minX) / 2 : this.x, sy ? (maxY + minY) / 2 : this.y));
      this.zoom += this.scaleZoom(s);
      this._unmodified = unmodified;
      this._constraining = false;
      return;
    }

    if (this.latRange) {
      const y = this.y;
      const h2 = size.y / 2;

      if (y - h2 < minY) y2 = minY + h2;
      if (y + h2 > maxY) y2 = maxY - h2;
    }

    if (this.lngRange) {
      const x = this.x;
      const w2 = size.x / 2;

      if (x - w2 < minX) x2 = minX + w2;
      if (x + w2 > maxX) x2 = maxX - w2;
    }

    // pan the map if the screen goes off the range
    if (x2 !== undefined || y2 !== undefined) {
      this.center = this.unproject(new Point(x2 !== undefined ? x2 : this.x, y2 !== undefined ? y2 : this.y));
    }

    this._unmodified = unmodified;
    this._constraining = false;
  }

  _calcMatrices() {
    if (!this.height) return;

    this.cameraToCenterDistance = (0.5 / Math.tan(this._fov / 2)) * this.height;

    // Find the distance from the center point [width/2, height/2] to the
    // center top point [width/2, 0] in Z units, using the law of sines.
    // 1 Z unit is equivalent to 1 horizontal px at the center of the map
    // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
    const halfFov = this._fov / 2;
    const groundAngle = Math.PI / 2 + this._pitch;
    const topHalfSurfaceDistance =
      (Math.sin(halfFov) * this.cameraToCenterDistance) / Math.sin(Math.PI - groundAngle - halfFov);
    const x = this.x;
    const y = this.y;

    // Calculate z distance of the farthest fragment that should be rendered.
    const furthestDistance = Math.cos(Math.PI / 2 - this._pitch) * topHalfSurfaceDistance + this.cameraToCenterDistance;
    // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
    const farZ = furthestDistance * 1.01;

    // matrix for conversion from location to GL coordinates (-1 .. 1)
    let m = new Float64Array(16);
    mat4.perspective(m, this._fov, this.width / this.height, 1, farZ);

    mat4.scale(m, m, [1, -1, 1]);
    mat4.translate(m, m, [0, 0, -this.cameraToCenterDistance]);
    mat4.rotateX(m, m, this._pitch);
    mat4.rotateZ(m, m, this.angle);
    mat4.translate(m, m, [-x, -y, 0]);

    // scale vertically to meters per pixel (inverse of ground resolution):
    // worldSize / (circumferenceOfEarth * cos(lat * π / 180))
    const verticalScale =
      this.worldSize / (2 * Math.PI * 6378137 * Math.abs(Math.cos(this.center.lat * (Math.PI / 180))));
    mat4.scale(m, m, [1, 1, verticalScale, 1]);

    this.projMatrix = m;

    // Make a second projection matrix that is aligned to a pixel grid for rendering raster tiles.
    // We're rounding the (floating point) x/y values to achieve to avoid rendering raster images to fractional
    // coordinates. Additionally, we adjust by half a pixel in either direction in case that viewport dimension
    // is an odd integer to preserve rendering to the pixel grid. We're rotating this shift based on the angle
    // of the transformation so that 0°, 90°, 180°, and 270° rasters are crisp, and adjust the shift so that
    // it is always <= 0.5 pixels.
    const xShift = (this.width % 2) / 2;
    const yShift = (this.height % 2) / 2;
    const angleCos = Math.cos(this.angle);
    const angleSin = Math.sin(this.angle);
    const dx = x - Math.round(x) + angleCos * xShift + angleSin * yShift;
    const dy = y - Math.round(y) + angleCos * yShift + angleSin * xShift;
    const alignedM = new Float64Array(m);
    mat4.translate(alignedM, alignedM, [dx > 0.5 ? dx - 1 : dx, dy > 0.5 ? dy - 1 : dy, 0]);
    this.alignedProjMatrix = alignedM;

    // matrix for conversion from location to screen coordinates
    m = mat4.create();
    mat4.scale(m, m, [this.width / 2, -this.height / 2, 1]);
    mat4.translate(m, m, [1, -1, 0]);
    this.pixelMatrix = mat4.multiply(new Float64Array(16), m, this.projMatrix);

    // inverse matrix for conversion from screen coordinaes to location
    m = mat4.invert(new Float64Array(16), this.pixelMatrix);
    if (!m) throw new Error('failed to invert matrix');
    this.pixelMatrixInverse = m;

    this._posMatrixCache = {};
    this._alignedPosMatrixCache = {};
  }

  maxPitchScaleFactor() {
    // calcMatrices hasn't run yet
    if (!this.pixelMatrixInverse) return 1;

    const coord = this.pointCoordinate(new Point(0, 0)).zoomTo(this.zoom);
    const p = [coord.column * this.tileSize, coord.row * this.tileSize, 0, 1];
    const topPoint = vec4.transformMat4(p, p, this.pixelMatrix);
    return topPoint[3] / this.cameraToCenterDistance;
  }

  /*
   * The camera looks at the map from a 3D (lng, lat, altitude) location. Let's use `cameraLocation`
   * as the name for the location under the camera and on the surface of the earth (lng, lat, 0).
   * `cameraPoint` is the projected position of the `cameraLocation`.
   *
   * This point is useful to us because only fill-extrusions that are between `cameraPoint` and
   * the query point on the surface of the earth can extend and intersect the query.
   *
   * When the map is not pitched the `cameraPoint` is equivalent to the center of the map because
   * the camera is right above the center of the map.
   */
  getCameraPoint() {
    const pitch = this._pitch;
    const yOffset = Math.tan(pitch) * (this.cameraToCenterDistance || 1);
    return this.centerPoint.add(new Point(0, yOffset));
  }

  /*
   * When the map is pitched, some of the 3D features that intersect a query will not intersect
   * the query at the surface of the earth. Instead the feature may be closer and only intersect
   * the query because it extrudes into the air.
   *
   * This returns a geometry that includes all of the original query as well as all possible ares of the
   * screen where the *base* of a visible extrusion could be.
   *  - For point queries, the line from the query point to the "camera point"
   *  - For other geometries, the envelope of the query geometry and the "camera point"
   */
  getCameraQueryGeometry(queryGeometry) {
    const c = this.getCameraPoint();

    if (queryGeometry.length === 1) {
      return [queryGeometry[0], c];
    }
    let minX = c.x;
    let minY = c.y;
    let maxX = c.x;
    let maxY = c.y;
    for (const p of queryGeometry) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return [
      new Point(minX, minY),
      new Point(maxX, minY),
      new Point(maxX, maxY),
      new Point(minX, maxY),
      new Point(minX, minY)
    ];
  }
}

module.exports = Transform;
