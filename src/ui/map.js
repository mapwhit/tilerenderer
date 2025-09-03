import Point from '@mapbox/point-geometry';
import { ErrorEvent, Event } from '@mapwhit/events';
import LngLat from '../geo/lng_lat.js';
import LngLatBounds from '../geo/lng_lat_bounds.js';
import Transform from '../geo/transform.js';
import Painter from '../render/painter.js';
import EvaluationParameters from '../style/evaluation_parameters.js';
import Style from '../style/style.js';
import browser from '../util/browser.js';
import DOM from '../util/dom.js';
import { RGBAImage } from '../util/image.js';
import loadImage from '../util/loader/image.js';
import { bindAll } from '../util/object.js';
import taskQueue from '../util/task_queue.js';
import warn from '../util/warn.js';
import Camera from './camera.js';

const defaultMinZoom = 0;
const defaultMaxZoom = 22;
const defaultOptions = {
  center: [0, 0],
  zoom: 0,
  bearing: 0,
  pitch: 0,

  minZoom: defaultMinZoom,
  maxZoom: defaultMaxZoom,

  interactive: true,

  bearingSnap: 7,

  attributionControl: true,

  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: false,

  trackResize: true,

  renderWorldCopies: true,

  transformRequest: null,
  fadeDuration: 300,
  crossSourceCollisions: true
};

/**
 * The `Map` object represents the map on your page. It exposes methods
 * and properties that enable you to programmatically change the map,
 * and fires events as users interact with it.
 *
 * You create a `Map` by specifying a `container` and other options.
 * Then Mapbox GL JS initializes the map on the page and returns your `Map`
 * object.
 *
 * @extends Evented
 * @param {Object} options
 * @param {HTMLElement|string} options.container The HTML element in which Mapbox GL JS will render the map, or the element's string `id`. The specified element must have no children.
 * @param {number} [options.minZoom=0] The minimum zoom level of the map (0-24).
 * @param {number} [options.maxZoom=22] The maximum zoom level of the map (0-24).
 * @param {Object|string} [options.style] The map's Mapbox style. This must be an a JSON object conforming to
 * the schema described in the [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL to
 * such JSON.
 *
 * To load a style from the Mapbox API, you can use a URL of the form `mapbox://styles/:owner/:style`,
 * where `:owner` is your Mapbox account name and `:style` is the style ID. Or you can use one of the following
 * [the predefined Mapbox styles](https://www.mapbox.com/maps/):
 *
 *  * `mapbox://styles/mapbox/streets-v9`
 *  * `mapbox://styles/mapbox/outdoors-v9`
 *  * `mapbox://styles/mapbox/light-v9`
 *  * `mapbox://styles/mapbox/dark-v9`
 *  * `mapbox://styles/mapbox/satellite-v9`
 *  * `mapbox://styles/mapbox/satellite-streets-v9`
 *
 * Tilesets hosted with Mapbox can be style-optimized if you append `?optimize=true` to the end of your style URL, like `mapbox://styles/mapbox/streets-v9?optimize=true`.
 * Learn more about style-optimized vector tiles in our [API documentation](https://www.mapbox.com/api-documentation/#retrieve-tiles).
 *
 * @param {boolean} [options.interactive=true] If `false`, no mouse, touch, or keyboard listeners will be attached to the map, so it will not respond to interaction.
 * @param {number} [options.bearingSnap=7] The threshold, measured in degrees, that determines when the map's
 *   bearing will snap to north. For example, with a `bearingSnap` of 7, if the user rotates
 *   the map within 7 degrees of north, the map will automatically snap to exact north.
 * @param {boolean} [options.pitchWithRotate=true] If `false`, the map's pitch (tilt) control with "drag to rotate" interaction will be disabled.
 * @param {string} [options.logoPosition='bottom-left'] A string representing the position of the Mapbox wordmark on the map. Valid options are `top-left`,`top-right`, `bottom-left`, `bottom-right`.
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] If `true`, map creation will fail if the performance of Mapbox
 *   GL JS would be dramatically worse than expected (i.e. a software renderer would be used).
 * @param {boolean} [options.preserveDrawingBuffer=false] If `true`, the map's canvas can be exported to a PNG using `map.getCanvas().toDataURL()`. This is `false` by default as a performance optimization.
 * @param {LngLatBoundsLike} [options.maxBounds] If set, the map will be constrained to the given bounds.
 * @param {boolean} [options.trackResize=true]  If `true`, the map will automatically resize when the browser window resizes.
 * @param {LngLatLike} [options.center=[0, 0]] The inital geographical centerpoint of the map. If `center` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `[0, 0]` Note: Mapbox GL uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match GeoJSON.
 * @param {number} [options.zoom=0] The initial zoom level of the map. If `zoom` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.bearing=0] The initial bearing (rotation) of the map, measured in degrees counter-clockwise from north. If `bearing` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {number} [options.pitch=0] The initial pitch (tilt) of the map, measured in degrees away from the plane of the screen (0-60). If `pitch` is not specified in the constructor options, Mapbox GL JS will look for it in the map's style object. If it is not specified in the style, either, it will default to `0`.
 * @param {boolean} [options.renderWorldCopies=true]  If `true`, multiple copies of the world will be rendered, when zoomed out.
 * @param {number} [options.fadeDuration=300] Controls the duration of the fade-in/fade-out animation for label collisions, in milliseconds. This setting affects all symbol layers. This setting does not affect the duration of runtime styling transitions or raster tile cross-fading.
 * @param {boolean} [options.crossSourceCollisions=true] If `true`, symbols from multiple sources can collide with each other during collision detection. If `false`, collision detection is run separately for the symbols in each source.
 * @example
 * var map = new mapboxgl.Map({
 *   container: 'map',
 *   center: [-122.420679, 37.772537],
 *   zoom: 13,
 *   style: style_object
 * });
 * @see [Display a map](https://www.mapbox.com/mapbox-gl-js/examples/)
 */
class Map extends Camera {
  constructor(options) {
    options = Object.assign({}, defaultOptions, options);

    if (options.minZoom != null && options.maxZoom != null && options.minZoom > options.maxZoom) {
      throw new Error('maxZoom must be greater than minZoom');
    }

    const transform = new Transform(options.minZoom, options.maxZoom, options.renderWorldCopies);
    super(transform, options);

    // use global loadImage implementation
    this.loadImage = loadImage;

    this._interactive = options.interactive;
    this._failIfMajorPerformanceCaveat = options.failIfMajorPerformanceCaveat;
    this._preserveDrawingBuffer = options.preserveDrawingBuffer;
    this._trackResize = options.trackResize;
    this._bearingSnap = options.bearingSnap;
    this._fadeDuration = options.fadeDuration;
    this._crossSourceCollisions = options.crossSourceCollisions;
    this._crossFadingFactor = 1;
    this._renderTaskQueue = taskQueue(this);

    if (typeof options.container === 'string') {
      const container = window.document.getElementById(options.container);
      if (!container) {
        throw new Error(`Container '${options.container}' not found.`);
      }
      this._container = container;
    } else if (options.container instanceof window.HTMLElement) {
      this._container = options.container;
    } else {
      throw new Error(`Invalid type: 'container' must be a String or HTMLElement.`);
    }

    if (options.maxBounds) {
      this.setMaxBounds(options.maxBounds);
    }

    bindAll(
      [
        '_onWindowOnline',
        '_onWindowResize',
        '_contextLost',
        '_contextRestored',
        '_update',
        '_render',
        '_onData',
        '_onDataLoading'
      ],
      this
    );

    this._setupContainer();
    this._setupPainter();
    if (this.painter === undefined) {
      throw new Error('Failed to initialize WebGL.');
    }

    this.on('move', this._update.bind(this, false));
    this.on('moveend', this._update.bind(this, false));
    this.on('zoom', this._update.bind(this, true));

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._onWindowOnline, false);
      window.addEventListener('resize', this._onWindowResize, false);
    }

    this.jumpTo({
      center: options.center,
      zoom: options.zoom,
      bearing: options.bearing,
      pitch: options.pitch
    });

    this.resize();

    if (options.style) {
      this.setStyle(options.style);
    }

    this.on('style.load', function () {
      if (this.transform.unmodified) {
        this.jumpTo(this.style.stylesheet);
      }
    });

    this.on('data', this._onData);
    this.on('dataloading', this._onDataLoading);
  }

  /**
   * Sets a global state property that can be retrieved with the [`global-state` expression](https://maplibre.org/maplibre-style-spec/expressions/#global-state).
   * If the value is null, it resets the property to its default value defined in the [`state` style property](https://maplibre.org/maplibre-style-spec/root/#state).
   *
   * @param propertyName - The name of the state property to set.
   * @param value - The value of the state property to set.
   */
  setGlobalStateProperty(propertyName, value) {
    if (!this.style.setGlobalStateProperty(propertyName, value)) {
      return this._update(true);
    }
  }

  /**
   * Returns the global map state
   *
   * @returns The map state object.
   */
  getGlobalState() {
    return this.style.getGlobalState();
  }

  /**
   * Adds a {@link IControl} to the map, calling `control.onAdd(this)`.
   *
   * @param {IControl} control The {@link IControl} to add.
   * @param {string} [position] position on the map to which the control will be added.
   * Valid values are `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`. Defaults to `'top-right'`.
   * @returns {Map} `this`
   * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
   */
  addControl(control, position) {
    if (position === undefined && control.getDefaultPosition) {
      position = control.getDefaultPosition();
    }
    if (position === undefined) {
      position = 'top-right';
    }
    const controlElement = control.onAdd(this);
    const positionContainer = this._controlPositions[position];
    if (position.indexOf('bottom') !== -1) {
      positionContainer.insertBefore(controlElement, positionContainer.firstChild);
    } else {
      positionContainer.appendChild(controlElement);
    }
    return this;
  }

  /**
   * Removes the control from the map.
   *
   * @param {IControl} control The {@link IControl} to remove.
   * @returns {Map} `this`
   */
  removeControl(control) {
    control.onRemove(this);
    return this;
  }

  /**
   * Resizes the map according to the dimensions of its
   * `container` element.
   *
   * This method must be called after the map's `container` is resized by another script,
   * or when the map is shown after being initially hidden with CSS.
   *
   * @param eventData Additional properties to be added to event objects of events triggered by this method.
   * @returns {Map} `this`
   */
  resize(eventData) {
    const dimensions = this._containerDimensions();
    const width = dimensions[0];
    const height = dimensions[1];

    this._resizeCanvas(width, height);
    this.transform.resize(width, height);
    this.painter.resize(width, height);

    return this.fire(new Event('movestart', eventData))
      .fire(new Event('move', eventData))
      .fire(new Event('resize', eventData))
      .fire(new Event('moveend', eventData));
  }

  /**
   * Returns the map's geographical bounds. When the bearing or pitch is non-zero, the visible region is not
   * an axis-aligned rectangle, and the result is the smallest bounds that encompasses the visible region.
   *
   * @returns {LngLatBounds}
   */
  getBounds() {
    return new LngLatBounds()
      .extend(this.transform.pointLocation(new Point(0, 0)))
      .extend(this.transform.pointLocation(new Point(this.transform.width, 0)))
      .extend(this.transform.pointLocation(new Point(this.transform.width, this.transform.height)))
      .extend(this.transform.pointLocation(new Point(0, this.transform.height)));
  }

  /**
   * Gets the map's geographical bounds.
   *
   * Returns the LngLatBounds by which pan and zoom operations on the map are constrained.
   *
   * @returns {LngLatBounds | null} The maximum bounds the map is constrained to, or `null` if none set.
   */
  getMaxBounds() {
    if (
      this.transform.latRange &&
      this.transform.latRange.length === 2 &&
      this.transform.lngRange &&
      this.transform.lngRange.length === 2
    ) {
      return new LngLatBounds(
        [this.transform.lngRange[0], this.transform.latRange[0]],
        [this.transform.lngRange[1], this.transform.latRange[1]]
      );
    }
    return null;
  }

  /**
   * Sets or clears the map's geographical bounds.
   *
   * Pan and zoom operations are constrained within these bounds.
   * If a pan or zoom is performed that would
   * display regions outside these bounds, the map will
   * instead display a position and zoom level
   * as close as possible to the operation's request while still
   * remaining within the bounds.
   *
   * @param {LngLatBoundsLike | null | undefined} lnglatbounds The maximum bounds to set. If `null` or `undefined` is provided, the function removes the map's maximum bounds.
   * @returns {Map} `this`
   */
  setMaxBounds(lnglatbounds) {
    if (lnglatbounds) {
      const b = LngLatBounds.convert(lnglatbounds);
      this.transform.lngRange = [b.getWest(), b.getEast()];
      this.transform.latRange = [b.getSouth(), b.getNorth()];
      this.transform._constrain();
      this._update();
    } else if (lnglatbounds === null || lnglatbounds === undefined) {
      this.transform.lngRange = null;
      this.transform.latRange = null;
      this._update();
    }
    return this;
  }

  /**
   * Sets or clears the map's minimum zoom level.
   * If the map's current zoom level is lower than the new minimum,
   * the map will zoom to the new minimum.
   *
   * @param {number | null | undefined} minZoom The minimum zoom level to set (0-24).
   *   If `null` or `undefined` is provided, the function removes the current minimum zoom (i.e. sets it to 0).
   * @returns {Map} `this`
   */
  setMinZoom(minZoom) {
    minZoom = minZoom === null || minZoom === undefined ? defaultMinZoom : minZoom;

    if (minZoom >= defaultMinZoom && minZoom <= this.transform.maxZoom) {
      this.transform.minZoom = minZoom;
      this._update();

      if (this.getZoom() < minZoom) {
        this.setZoom(minZoom);
      }

      return this;
    }
    throw new Error(`minZoom must be between ${defaultMinZoom} and the current maxZoom, inclusive`);
  }

  /**
   * Returns the map's minimum allowable zoom level.
   *
   * @returns {number} minZoom
   */
  getMinZoom() {
    return this.transform.minZoom;
  }

  /**
   * Sets or clears the map's maximum zoom level.
   * If the map's current zoom level is higher than the new maximum,
   * the map will zoom to the new maximum.
   *
   * @param {number | null | undefined} maxZoom The maximum zoom level to set.
   *   If `null` or `undefined` is provided, the function removes the current maximum zoom (sets it to 22).
   * @returns {Map} `this`
   */
  setMaxZoom(maxZoom) {
    maxZoom = maxZoom === null || maxZoom === undefined ? defaultMaxZoom : maxZoom;

    if (maxZoom >= this.transform.minZoom) {
      this.transform.maxZoom = maxZoom;
      this._update();

      if (this.getZoom() > maxZoom) {
        this.setZoom(maxZoom);
      }

      return this;
    }
    throw new Error('maxZoom must be greater than the current minZoom');
  }

  /**
   * Returns the state of renderWorldCopies.
   *
   * @returns {boolean} renderWorldCopies
   */
  getRenderWorldCopies() {
    return this.transform.renderWorldCopies;
  }

  /**
   * Sets the state of renderWorldCopies.
   *
   * @param {boolean} renderWorldCopies If `true`, multiple copies of the world will be rendered, when zoomed out. `undefined` is treated as `true`, `null` is treated as `false`.
   * @returns {Map} `this`
   */
  setRenderWorldCopies(renderWorldCopies) {
    this.transform.renderWorldCopies = renderWorldCopies;
    this._update();

    return this;
  }

  /**
   * Returns the map's maximum allowable zoom level.
   *
   * @returns {number} maxZoom
   */
  getMaxZoom() {
    return this.transform.maxZoom;
  }

  /**
   * Returns a {@link Point} representing pixel coordinates, relative to the map's `container`,
   * that correspond to the specified geographical location.
   *
   * @param {LngLatLike} lnglat The geographical location to project.
   * @returns {Point} The {@link Point} corresponding to `lnglat`, relative to the map's `container`.
   */
  project(lnglat) {
    return this.transform.locationPoint(LngLat.convert(lnglat));
  }

  /**
   * Returns a {@link LngLat} representing geographical coordinates that correspond
   * to the specified pixel coordinates.
   *
   * @param {PointLike} point The pixel coordinates to unproject.
   * @returns {LngLat} The {@link LngLat} corresponding to `point`.
   * @see [Show polygon information on click](https://www.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/)
   */
  unproject(point) {
    return this.transform.pointLocation(Point.convert(point));
  }

  /**
   * Returns true if the map is panning, zooming, rotating, or pitching due to a camera animation or user gesture.
   */
  isMoving() {
    return !!(this._moving || this._mapGestures?.isMoving());
  }

  /**
   * Returns true if the map is zooming due to a camera animation or user gesture.
   */
  isZooming() {
    return !!(this._zooming || this._mapGestures?.isZooming());
  }

  /**
   * Returns true if the map is rotating due to a camera animation or user gesture.
   */
  isRotating() {
    return !!(this._rotating || this._mapGestures?.isRotating());
  }

  /**
   * Returns an array of [GeoJSON](http://geojson.org/)
   * [Feature objects](https://tools.ietf.org/html/rfc7946#section-3.2)
   * representing visible features that satisfy the query parameters.
   *
   * @param {PointLike|Array<PointLike>} [geometry] - The geometry of the query region:
   * either a single point or southwest and northeast points describing a bounding box.
   * Omitting this parameter (i.e. calling {@link Map#queryRenderedFeatures} with zero arguments,
   * or with only a `options` argument) is equivalent to passing a bounding box encompassing the entire
   * map viewport.
   * @param {Object} [options]
   * @param {Array<string>} [options.layers] An array of style layer IDs for the query to inspect.
   *   Only features within these layers will be returned. If this parameter is undefined, all layers will be checked.
   * @param {Array} [options.filter] A [filter](https://www.mapbox.com/mapbox-gl-js/style-spec/#other-filter)
   *   to limit query results.
   *
   * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
   * [feature objects](https://tools.ietf.org/html/rfc7946#section-3.2).
   *
   * The `properties` value of each returned feature object contains the properties of its source feature. For GeoJSON sources, only
   * string and numeric property values are supported (i.e. `null`, `Array`, and `Object` values are not supported).
   *
   * Each feature includes top-level `layer`, `source`, and `sourceLayer` properties. The `layer` property is an object
   * representing the style layer to  which the feature belongs. Layout and paint properties in this object contain values
   * which are fully evaluated for the given zoom level and feature.
   *
   * Features from layers whose `visibility` property is `"none"`, or from layers whose zoom range excludes the
   * current zoom level are not included. Symbol features that have been hidden due to text or icon collision are
   * not included. Features from all other layers are included, including features that may have no visible
   * contribution to the rendered result; for example, because the layer's opacity or color alpha component is set to
   * 0.
   *
   * The topmost rendered feature appears first in the returned array, and subsequent features are sorted by
   * descending z-order. Features that are rendered multiple times (due to wrapping across the antimeridian at low
   * zoom levels) are returned only once (though subject to the following caveat).
   *
   * Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature
   * geometries may be split or duplicated across tile boundaries and, as a result, features may appear multiple
   * times in query results. For example, suppose there is a highway running through the bounding rectangle of a query.
   * The results of the query will be those parts of the highway that lie within the map tiles covering the bounding
   * rectangle, even if the highway extends into other tiles, and the portion of the highway within each map tile
   * will be returned as a separate feature. Similarly, a point feature near a tile boundary may appear in multiple
   * tiles due to tile buffering.
   *
   * @example
   * // Find all features at a point
   * var features = map.queryRenderedFeatures(
   *   [20, 35],
   *   { layers: ['my-layer-name'] }
   * );
   *
   * @example
   * // Find all features within a static bounding box
   * var features = map.queryRenderedFeatures(
   *   [[10, 20], [30, 50]],
   *   { layers: ['my-layer-name'] }
   * );
   *
   * @example
   * // Find all features within a bounding box around a point
   * var width = 10;
   * var height = 20;
   * var features = map.queryRenderedFeatures([
   *   [point.x - width / 2, point.y - height / 2],
   *   [point.x + width / 2, point.y + height / 2]
   * ], { layers: ['my-layer-name'] });
   *
   * @example
   * // Query all rendered features from a single layer
   * var features = map.queryRenderedFeatures({ layers: ['my-layer-name'] });
   * @see [Get features under the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures/)
   * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
   * @see [Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
   */
  queryRenderedFeatures(geometry, options) {
    // The first parameter can be omitted entirely, making this effectively an overloaded method
    // with two signatures:
    //
    //     queryRenderedFeatures(geometry: PointLike | [PointLike, PointLike], options?: Object)
    //     queryRenderedFeatures(options?: Object)
    //
    if (arguments.length === 2) {
      geometry = arguments[0];
      options = arguments[1];
    } else if (arguments.length === 1 && isPointLike(arguments[0])) {
      geometry = arguments[0];
      options = {};
    } else if (arguments.length === 1) {
      geometry = undefined;
      options = arguments[0];
    } else {
      geometry = undefined;
      options = {};
    }

    if (!this.style) {
      return [];
    }

    return this.style.queryRenderedFeatures(this._makeQueryGeometry(geometry), options, this.transform) || [];

    function isPointLike(input) {
      return input instanceof Point || Array.isArray(input);
    }
  }

  _makeQueryGeometry(pointOrBox) {
    if (pointOrBox === undefined) {
      // bounds was omitted: use full viewport
      pointOrBox = [Point.convert([0, 0]), Point.convert([this.transform.width, this.transform.height])];
    }

    let queryGeometry;

    if (pointOrBox instanceof Point || typeof pointOrBox[0] === 'number') {
      const point = Point.convert(pointOrBox);
      queryGeometry = [point];
    } else {
      const box = [Point.convert(pointOrBox[0]), Point.convert(pointOrBox[1])];
      queryGeometry = [box[0], new Point(box[1].x, box[0].y), box[1], new Point(box[0].x, box[1].y), box[0]];
    }

    return {
      viewport: queryGeometry,
      worldCoordinate: queryGeometry.map(p => {
        return this.transform.pointCoordinate(p);
      })
    };
  }

  /**
   * Returns an array of [GeoJSON](http://geojson.org/)
   * [Feature objects](https://tools.ietf.org/html/rfc7946#section-3.2)
   * representing features within the specified vector tile or GeoJSON source that satisfy the query parameters.
   *
   * @param {string} sourceID The ID of the vector tile or GeoJSON source to query.
   * @param {Object} [parameters]
   * @param {string} [parameters.sourceLayer] The name of the vector tile layer to query. *For vector tile
   *   sources, this parameter is required.* For GeoJSON sources, it is ignored.
   * @param {Array} [parameters.filter] A [filter](https://www.mapbox.com/mapbox-gl-js/style-spec/#other-filter)
   *   to limit query results.
   *
   * @returns {Array<Object>} An array of [GeoJSON](http://geojson.org/)
   * [Feature objects](https://tools.ietf.org/html/rfc7946#section-3.2).
   *
   * In contrast to {@link Map#queryRenderedFeatures}, this function
   * returns all features matching the query parameters,
   * whether or not they are rendered by the current style (i.e. visible). The domain of the query includes all currently-loaded
   * vector tiles and GeoJSON source tiles: this function does not check tiles outside the currently
   * visible viewport.
   *
   * Because features come from tiled vector data or GeoJSON data that is converted to tiles internally, feature
   * geometries may be split or duplicated across tile boundaries and, as a result, features may appear multiple
   * times in query results. For example, suppose there is a highway running through the bounding rectangle of a query.
   * The results of the query will be those parts of the highway that lie within the map tiles covering the bounding
   * rectangle, even if the highway extends into other tiles, and the portion of the highway within each map tile
   * will be returned as a separate feature. Similarly, a point feature near a tile boundary may appear in multiple
   * tiles due to tile buffering.
   * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
   * @see [Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
   */
  querySourceFeatures(sourceID, parameters) {
    return this.style.querySourceFeatures(sourceID, parameters);
  }

  /**
   * Updates the map's Mapbox style object with a new value.  If the given
   * value is style JSON object, compares it against the the map's current
   * state and perform only the changes necessary to make the map style match
   * the desired state.
   *
   * @param style A JSON object conforming to the schema described in the
   *   [Mapbox Style Specification](https://mapbox.com/mapbox-gl-style-spec/), or a URL to such JSON.
   * @param {Object} [options]
   * @param {boolean} [options.diff=true] If false, force a 'full' update, removing the current style
   *   and adding building the given one instead of attempting a diff-based update.
   * @returns {Map} `this`
   * @see [Change a map's style](https://www.mapbox.com/mapbox-gl-js/example/setstyle/)
   */
  setStyle(style, options) {
    if (this.style) {
      this.style.setEventedParent(null);
      this.style._remove();
    }

    if (!style) {
      delete this.style;
      return this;
    }
    this.style = new Style(this, options || {});

    this.style.setEventedParent(this, { style: this.style });

    // style is expected to be an object
    this.style.loadJSON(style);

    return this;
  }

  /**
   * Returns the map's Mapbox style object, which can be used to recreate the map's style.
   *
   * @returns {Object} The map's style object.
   */
  getStyle() {
    if (this.style) {
      return this.style.serialize?.() ?? this.style;
    }
  }

  /**
   * Returns a Boolean indicating whether the map's style is fully loaded.
   *
   * @returns {boolean} A Boolean indicating whether the style is fully loaded.
   */
  isStyleLoaded() {
    if (!this.style) {
      return warn.once('There is no style added to the map.');
    }
    return this.style.loaded(true);
  }

  /**
   * Adds a source to the map's style.
   *
   * @param {string} id The ID of the source to add. Must not conflict with existing sources.
   * @param {Object} source The source object, conforming to the
   * Mapbox Style Specification's [source definition](https://www.mapbox.com/mapbox-gl-style-spec/#sources) or
   * {@link CanvasSourceOptions}.
   * @fires source.add
   * @returns {Map} `this`
   * @see [Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
   * @see [Style circles using data-driven styling](https://www.mapbox.com/mapbox-gl-js/example/data-driven-circle-colors/)
   * @see [Set a point after Geocoder result](https://www.mapbox.com/mapbox-gl-js/example/point-from-geocoder-result/)
   */
  addSource(id, source) {
    this.style.addSource(id, source);
    this._update(true);
    return this;
  }

  /**
   * Returns a Boolean indicating whether the source is loaded.
   *
   * @param {string} id The ID of the source to be checked.
   * @returns {boolean} A Boolean indicating whether the source is loaded.
   */
  isSourceLoaded(id) {
    const source = this.style?._sources[id];
    if (source === undefined) {
      this.fire(new ErrorEvent(new Error(`There is no source with ID '${id}'`)));
      return;
    }
    return source.loaded();
  }

  /**
   * Returns a Boolean indicating whether all tiles in the viewport from all sources on
   * the style are loaded.
   *
   * @returns {boolean} A Boolean indicating whether all tiles are loaded.
   */

  areTilesLoaded() {
    const sources = this.style?._sources;
    for (const id in sources) {
      const source = sources[id];
      const tiles = source._tiles;
      for (const tile of tiles.values()) {
        if (!(tile.state === 'loaded' || tile.state === 'errored')) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Removes a source from the map's style.
   *
   * @param {string} id The ID of the source to remove.
   * @returns {Map} `this`
   */
  removeSource(id) {
    this.style.removeSource(id);
    this._update(true);
    return this;
  }

  /**
   * Returns the source with the specified ID in the map's style.
   *
   * @param {string} id The ID of the source to get.
   * @returns {?Object} The style source with the specified ID, or `undefined`
   *   if the ID corresponds to no existing sources.
   * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
   * @see [Animate a point](https://www.mapbox.com/mapbox-gl-js/example/animate-point-along-line/)
   * @see [Add live realtime data](https://www.mapbox.com/mapbox-gl-js/example/live-geojson/)
   */
  getSource(id) {
    return this.style.getSource(id);
  }

  /**
   * Add an image to the style. This image can be used in `icon-image`,
   * `background-pattern`, `fill-pattern`, and `line-pattern`. An
   * {@link Map#error} event will be fired if there is not enough space in the
   * sprite to add this image.
   *
   * @see [Add an icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image/)
   * @see [Add a generated icon to the map](https://www.mapbox.com/mapbox-gl-js/example/add-image-generated/)
   * @param id The ID of the image.
   * @param image The image as an `HTMLImageElement`, `ImageData`, or object with `width`, `height`, and `data`
   * properties with the same format as `ImageData`.
   * @param options
   * @param options.pixelRatio The ratio of pixels in the image to physical pixels on the screen
   * @param options.sdf Whether the image should be interpreted as an SDF image
   */
  addImage(id, image, { pixelRatio = 1, sdf = false } = {}) {
    if (image instanceof HTMLImageElement) {
      if (!image.complete) {
        const promise = new Promise(resolve => {
          image.decode().then(() => {
            const { width, height, data } = browser.getImageData(image);
            resolve({ data: new RGBAImage({ width, height }, data), pixelRatio, sdf });
          });
        });
        this.style.addImage(id, { promise });
        return;
      }
      const { width, height, data } = browser.getImageData(image);
      this.style.addImage(id, { data: new RGBAImage({ width, height }, data), pixelRatio, sdf });
    } else if (image.width === undefined || image.height === undefined) {
      return this.fire(
        new ErrorEvent(
          new Error(
            'Invalid arguments to map.addImage(). The second argument must be an `HTMLImageElement`, `ImageData`, ' +
              'or object with `width`, `height`, and `data` properties with the same format as `ImageData`'
          )
        )
      );
    } else {
      const { width, height, data } = image;
      this.style.addImage(id, {
        data: new RGBAImage({ width, height }, new Uint8Array(data)),
        pixelRatio,
        sdf
      });
    }
  }

  /**
   * Returns an image, specified by ID, currently available in the map.
   * This includes both images from the style's original sprite
   * and any images that have been added at runtime using {@link Map.addImage}.
   *
   * @param id - The ID of the image.
   * @returns An image in the map with the specified ID.
   *
   * @example
   * ```js
   * let coffeeShopIcon = map.getImage("coffee_cup");
   * ```
   */
  getImage(id) {
    return this.style.getImage(id);
  }

  /**
   * Define wether the image has been added or not
   *
   * @param id The ID of the image.
   */
  hasImage(id) {
    if (!id) {
      this.fire(new ErrorEvent(new Error('Missing required image id')));
      return false;
    }

    return !!this.style.getImage(id);
  }

  /**
   * Remove an image from the style (such as one used by `icon-image` or `background-pattern`).
   *
   * @param id The ID of the image.
   */
  removeImage(id) {
    this.style.removeImage(id);
  }

  /**
   * Returns an Array of strings containing the names of all sprites/images currently available in the map
   *
   * @returns {Array<string>} An Array of strings containing the names of all sprites/images currently available in the map
   *
   */
  listImages() {
    return this.style.listImages();
  }

  /**
   * Adds a [Mapbox style layer](https://www.mapbox.com/mapbox-gl-style-spec/#layers)
   * to the map's style.
   *
   * A layer defines styling for data from a specified source.
   *
   * @param {Object} layer The style layer to add, conforming to the Mapbox Style Specification's
   *   [layer definition](https://www.mapbox.com/mapbox-gl-style-spec/#layers).
   * @param {string} [before] The ID of an existing layer to insert the new layer before.
   *   If this argument is omitted, the layer will be appended to the end of the layers array.
   * @returns {Map} `this`
   * @see [Create and style clusters](https://www.mapbox.com/mapbox-gl-js/example/cluster/)
   * @see [Add a vector tile source](https://www.mapbox.com/mapbox-gl-js/example/vector-source/)
   * @see [Add a WMS source](https://www.mapbox.com/mapbox-gl-js/example/wms/)
   */
  addLayer(layer, before) {
    this.style.addLayer(layer, before);
    this._update(true);
    return this;
  }

  /**
   * Moves a layer to a different z-position.
   *
   * @param {string} id The ID of the layer to move.
   * @param {string} [beforeId] The ID of an existing layer to insert the new layer before.
   *   If this argument is omitted, the layer will be appended to the end of the layers array.
   * @returns {Map} `this`
   */
  moveLayer(id, beforeId) {
    this.style.moveLayer(id, beforeId);
    this._update(true);
    return this;
  }

  /**
   * Removes the layer with the given id from the map's style.
   *
   * If no such layer exists, an `error` event is fired.
   *
   * @param {string} id id of the layer to remove
   * @fires error
   */
  removeLayer(id) {
    this.style.removeLayer(id);
    this._update(true);
    return this;
  }

  /**
   * Returns the layer with the specified ID in the map's style.
   *
   * @param {string} id The ID of the layer to get.
   * @returns {?Object} The layer with the specified ID, or `undefined`
   *   if the ID corresponds to no existing layers.
   * @see [Filter symbols by toggling a list](https://www.mapbox.com/mapbox-gl-js/example/filter-markers/)
   * @see [Filter symbols by text input](https://www.mapbox.com/mapbox-gl-js/example/filter-markers-by-input/)
   */
  getLayer(id) {
    return this.style.getLayer(id);
  }

  /**
   * Sets the filter for the specified style layer.
   *
   * @param {string} layer The ID of the layer to which the filter will be applied.
   * @param {Array | null | undefined} filter The filter, conforming to the Mapbox Style Specification's
   *   [filter definition](https://www.mapbox.com/mapbox-gl-js/style-spec/#other-filter).  If `null` or `undefined` is provided, the function removes any existing filter from the layer.
   * @returns {Map} `this`
   * @example
   * map.setFilter('my-layer', ['==', 'name', 'USA']);
   * @see [Filter features within map view](https://www.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/)
   * @see [Highlight features containing similar data](https://www.mapbox.com/mapbox-gl-js/example/query-similar-features/)
   * @see [Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
   */
  setFilter(layer, filter) {
    this.style.setFilter(layer, filter);
    this._update(true);
    return this;
  }

  /**
   * Sets the zoom extent for the specified style layer.
   *
   * @param {string} layerId The ID of the layer to which the zoom extent will be applied.
   * @param {number} minzoom The minimum zoom to set (0-24).
   * @param {number} maxzoom The maximum zoom to set (0-24).
   * @returns {Map} `this`
   * @example
   * map.setLayerZoomRange('my-layer', 2, 5);
   */
  setLayerZoomRange(layerId, minzoom, maxzoom) {
    this.style.setLayerZoomRange(layerId, minzoom, maxzoom);
    this._update(true);
    return this;
  }

  /**
   * Returns the filter applied to the specified style layer.
   *
   * @param {string} layer The ID of the style layer whose filter to get.
   * @returns {Array} The layer's filter.
   */
  getFilter(layer) {
    return this.style.getFilter(layer);
  }

  /**
   * Sets the value of a paint property in the specified style layer.
   *
   * @param {string} layer The ID of the layer to set the paint property in.
   * @param {string} name The name of the paint property to set.
   * @param {*} value The value of the paint propery to set.
   *   Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
   * @returns {Map} `this`
   * @example
   * map.setPaintProperty('my-layer', 'fill-color', '#faafee');
   * @see [Change a layer's color with buttons](https://www.mapbox.com/mapbox-gl-js/example/color-switcher/)
   * @see [Adjust a layer's opacity](https://www.mapbox.com/mapbox-gl-js/example/adjust-layer-opacity/)
   * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
   */
  setPaintProperty(layer, name, value) {
    this.style.setPaintProperty(layer, name, value);
    this._update(true);
    return this;
  }

  /**
   * Returns the value of a paint property in the specified style layer.
   *
   * @param {string} layer The ID of the layer to get the paint property from.
   * @param {string} name The name of a paint property to get.
   * @returns {*} The value of the specified paint property.
   */
  getPaintProperty(layer, name) {
    return this.style.getPaintProperty(layer, name);
  }

  /**
   * Sets the value of a layout property in the specified style layer.
   *
   * @param {string} layer The ID of the layer to set the layout property in.
   * @param {string} name The name of the layout property to set.
   * @param {*} value The value of the layout propery. Must be of a type appropriate for the property, as defined in the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
   * @returns {Map} `this`
   * @example
   * map.setLayoutProperty('my-layer', 'visibility', 'none');
   */
  setLayoutProperty(layer, name, value) {
    this.style.setLayoutProperty(layer, name, value);
    this._update(true);
    return this;
  }

  /**
   * Returns the value of a layout property in the specified style layer.
   *
   * @param {string} layer The ID of the layer to get the layout property from.
   * @param {string} name The name of the layout property to get.
   * @returns {*} The value of the specified layout property.
   */
  getLayoutProperty(layer, name) {
    return this.style.getLayoutProperty(layer, name);
  }

  /**
   * Sets the any combination of light values.
   *
   * @param light Light properties to set. Must conform to the [Mapbox Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/).
   * @returns {Map} `this`
   */
  setLight(light) {
    this.style.setLight(light);
    this._update(true);
    return this;
  }

  /**
   * Returns the value of the light object.
   *
   * @returns {Object} light Light properties of the style.
   */
  getLight() {
    return this.style.getLight();
  }

  /**
   * Sets the state of a feature. The `state` object is merged in with the existing state of the feature.
   *
   * @param {Object} [feature] Feature identifier. Feature objects returned from
   * {@link Map#queryRenderedFeatures} or event handlers can be used as feature identifiers.
   * @param {string} [feature.id] Unique id of the feature.
   * @param {string} [feature.source] The Id of the vector source or GeoJSON source for the feature.
   * @param {string} [feature.sourceLayer] (optional)  *For vector tile sources, the sourceLayer is
   *  required.*
   * @param {Object} state A set of key-value pairs. The values should be valid JSON types.
   *
   * This method requires the `feature.id` attribute on data sets. For GeoJSON sources without
   * feature ids, set the `generateIds` option in the `GeoJSONSourceSpecification` to auto-assign them. This
   * option assigns ids based on a feature's index in the source data. Changing the feature data using
   * `map.getSource('some id').setData(..)` resets the cache of feature states and requires the
   * caller re-apply the state as needed with the updated `id` values.
   */
  setFeatureState(feature, state) {
    this.style.setFeatureState(feature, state);
    this._update();
  }

  /**
   * Removes feature state, setting it back to the default behavior. If only
   * source is specified, removes all states of that source. If
   * target.id is also specified, removes all keys for that feature's state.
   * If key is also specified, removes that key from that feature's state.
   *
   * @param {Object} target Identifier of where to set state: can be a source, a feature, or a specific key of feature.
   * Feature objects returned from {@link Map#queryRenderedFeatures} or event handlers can be used as feature identifiers.
   * @param {string | number} target.id (optional) Unique id of the feature. Optional if key is not specified.
   * @param {string} target.source The Id of the vector source or GeoJSON source for the feature.
   * @param {string} [target.sourceLayer] (optional)  *For vector tile sources, the sourceLayer is
   *  required.*
   * @param {string} key (optional) The key in the feature state to reset.
   */
  removeFeatureState(target, key) {
    this.style.removeFeatureState(target, key);
    return this._update();
  }
  /**
   * Gets the state of a feature.
   *
   * @param {Object} [feature] Feature identifier. Feature objects returned from
   * {@link Map#queryRenderedFeatures} or event handlers can be used as feature identifiers.
   * @param {string} [feature.source] The Id of the vector source or GeoJSON source for the feature.
   * @param {string} [feature.sourceLayer] (optional)  *For vector tile sources, the sourceLayer is
   *  required.*
   * @param {string} [feature.id] Unique id of the feature.
   *
   * @returns {Object} The state of the feature.
   */
  getFeatureState(feature) {
    return this.style.getFeatureState(feature);
  }

  /**
   * Returns the map's containing HTML element.
   *
   * @returns {HTMLElement} The map's container.
   */
  getContainer() {
    return this._container;
  }

  /**
   * Returns the HTML element containing the map's `<canvas>` element.
   *
   * If you want to add non-GL overlays to the map, you should append them to this element.
   *
   * This is the element to which event bindings for map interactivity (such as panning and zooming) are
   * attached. It will receive bubbled events from child elements such as the `<canvas>`, but not from
   * map controls.
   *
   * @returns {HTMLElement} The container of the map's `<canvas>`.
   * @see [Create a draggable point](https://www.mapbox.com/mapbox-gl-js/example/drag-a-point/)
   * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
   */
  getCanvasContainer() {
    return this._canvasContainer;
  }

  /**
   * Returns the map's `<canvas>` element.
   *
   * @returns {HTMLCanvasElement} The map's `<canvas>` element.
   * @see [Measure distances](https://www.mapbox.com/mapbox-gl-js/example/measure/)
   * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
   * @see [Center the map on a clicked symbol](https://www.mapbox.com/mapbox-gl-js/example/center-on-symbol/)
   */
  getCanvas() {
    return this._canvas;
  }

  _containerDimensions() {
    let width = 0;
    let height = 0;

    if (this._container) {
      width = this._container.offsetWidth || 400;
      height = this._container.offsetHeight || 300;
    }

    return [width, height];
  }

  _setupContainer() {
    const container = this._container;
    container.classList.add('mapboxgl-map');

    const canvasContainer = (this._canvasContainer = DOM.create('div', 'mapboxgl-canvas-container', container));
    if (this._interactive) {
      canvasContainer.classList.add('mapboxgl-interactive');
    }

    this._canvas = DOM.create('canvas', 'mapboxgl-canvas', canvasContainer);
    this._canvas.style.position = 'absolute';
    this._canvas.addEventListener('webglcontextlost', this._contextLost, false);
    this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false);
    this._canvas.setAttribute('tabindex', '0');
    this._canvas.setAttribute('aria-label', 'Map');

    const dimensions = this._containerDimensions();
    this._resizeCanvas(dimensions[0], dimensions[1]);

    const controlContainer = (this._controlContainer = DOM.create('div', 'mapboxgl-control-container', container));
    const positions = (this._controlPositions = {});
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(positionName => {
      positions[positionName] = DOM.create('div', `mapboxgl-ctrl-${positionName}`, controlContainer);
    });
  }

  _resizeCanvas(width, height) {
    const pixelRatio = window.devicePixelRatio || 1;

    // Request the required canvas size taking the pixelratio into account.
    this._canvas.width = pixelRatio * width;
    this._canvas.height = pixelRatio * height;

    // Maintain the same canvas size, potentially downscaling it for HiDPI displays
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;
  }

  _setupPainter() {
    const attributes = {
      antialias: false,
      alpha: true,
      stencil: true,
      depth: true,
      failIfMajorPerformanceCaveat: this._failIfMajorPerformanceCaveat,
      preserveDrawingBuffer: this._preserveDrawingBuffer
    };

    const gl =
      this._canvas.getContext('webgl', attributes) || this._canvas.getContext('experimental-webgl', attributes);

    if (!gl) {
      throw new Error('Failed to initialize WebGL');
    }

    this.painter = new Painter(gl, this.transform);
  }

  _contextLost(event) {
    event.preventDefault();
    if (this._frameId) {
      browser.cancelFrame(this._frameId);
      this._frameId = null;
    }
    this.fire(new Event('webglcontextlost', { originalEvent: event }));
  }

  _contextRestored(event) {
    this._setupPainter();
    this.resize();
    this._update();
    this.fire(new Event('webglcontextrestored', { originalEvent: event }));
  }

  /**
   * Returns a Boolean indicating whether the map is fully loaded.
   *
   * Returns `false` if the style is not yet fully loaded,
   * or if there has been a change to the sources or style that
   * has not yet fully loaded.
   *
   * @returns {boolean} A Boolean indicating whether the map is fully loaded.
   */
  loaded() {
    if (this._styleDirty || this._sourcesDirty) {
      return false;
    }
    if (!this.style || !this.style.loaded()) {
      return false;
    }
    return true;
  }

  /**
   * Update this map's style and sources, and re-render the map.
   *
   * @param {boolean} updateStyle mark the map's style for reprocessing as
   * well as its sources
   * @returns {Map} this
   * @private
   */
  _update(updateStyle) {
    if (!this.style) {
      return;
    }

    this._styleDirty = this._styleDirty || updateStyle;
    this._sourcesDirty = true;

    this._rerender();
  }

  /**
   * Request that the given callback be executed during the next render
   * frame.  Schedule a render frame if one is not already scheduled.
   * @returns An id that can be used to cancel the callback
   * @private
   */
  _requestRenderFrame(callback) {
    this._update();
    return this._renderTaskQueue.add(callback);
  }

  _cancelRenderFrame(id) {
    this._renderTaskQueue.remove(id);
  }

  /**
   * Call when a (re-)render of the map is required:
   * - The style has changed (`setPaintProperty()`, etc.)
   * - Source data has changed (e.g. tiles have finished loading)
   * - The map has is moving (or just finished moving)
   * - A transition is in progress
   *
   * @returns {Map} this
   * @private
   */
  _render() {
    this._renderTaskQueue.run();

    let crossFading = false;

    // If the style has changed, the map is being zoomed, or a transition or fade is in progress:
    //  - Apply style changes (in a batch)
    //  - Recalculate paint properties.
    if (this.style && this._styleDirty) {
      this._styleDirty = false;

      const zoom = this.transform.zoom;
      const now = browser.now();
      this.style.zoomHistory.update(zoom, now);

      const parameters = new EvaluationParameters(zoom, {
        now,
        fadeDuration: this._fadeDuration,
        zoomHistory: this.style.zoomHistory,
        transition: this.style.getTransition(),
        globalState: this.style.getGlobalState()
      });

      const factor = parameters.crossFadingFactor();
      if (factor !== 1 || factor !== this._crossFadingFactor) {
        crossFading = true;
        this._crossFadingFactor = factor;
      }

      this.style.update(parameters);
    }

    // If we are in _render for any reason other than an in-progress paint
    // transition, update source caches to check for and load any tiles we
    // need for the current transform
    if (this.style && this._sourcesDirty) {
      this._sourcesDirty = false;
      this.style._updateSources(this.transform);
    }

    this._placementDirty = this.style?._updatePlacement(
      this.painter.transform,
      this.showCollisionBoxes,
      this._fadeDuration,
      this._crossSourceCollisions
    );

    // Actually draw
    this.painter.render(this.style, {
      showTileBoundaries: this.showTileBoundaries,
      showOverdrawInspector: this._showOverdrawInspector,
      rotating: this.isRotating(),
      zooming: this.isZooming(),
      moving: this.isMoving(),
      fadeDuration: this._fadeDuration
    });

    this.fire(new Event('render'));

    if (this.loaded() && !this._loaded) {
      this._loaded = true;
      this.fire(new Event('load'));
    }

    if (this.style && (this.style.hasTransitions() || crossFading)) {
      this._styleDirty = true;
    }

    if (this.style && !this._placementDirty) {
      // Since no fade operations are in progress, we can release
      // all tiles held for fading. If we didn't do this, the tiles
      // would just sit in the SourceCaches until the next render
      this.style._releaseSymbolFadeTiles();
    }

    // Schedule another render frame if it's needed.
    //
    // Even though `_styleDirty` and `_sourcesDirty` are reset in this
    // method, synchronous events fired during Style#update or
    // Style#_updateSources could have caused them to be set again.
    if (this._sourcesDirty || this._repaint || this._styleDirty || this._placementDirty) {
      this._rerender();
    } else if (!this.isMoving() && this.loaded()) {
      this.fire(new Event('idle'));
    }

    return this;
  }

  /**
   * Clean up and release all internal resources associated with this map.
   *
   * This includes DOM elements, event bindings, web workers, and WebGL resources.
   *
   * Use this method when you are done using the map and wish to ensure that it no
   * longer consumes browser resources. Afterwards, you must not call any other
   * methods on the map.
   */
  remove() {
    browser.cancelFrame(this._frameId);
    this._renderTaskQueue.clear();
    this._frameId = null;
    this.setStyle(null);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onWindowResize, false);
      window.removeEventListener('online', this._onWindowOnline, false);
    }
    const extension = this.painter.context.gl.getExtension('WEBGL_lose_context');
    if (extension) {
      extension.loseContext();
    }
    removeNode(this._canvasContainer);
    removeNode(this._controlContainer);
    this._container.classList.remove('mapboxgl-map');
    this.fire(new Event('remove'));
  }

  _rerender() {
    if (this.style && !this._frameId) {
      this._frameId = browser.frame(() => {
        this._frameId = null;
        this._render();
      });
    }
  }

  _onWindowOnline() {
    this._update();
  }

  _onWindowResize() {
    if (this._trackResize) {
      this.stop().resize()._update();
    }
  }

  /**
   * Gets and sets a Boolean indicating whether the map will render an outline
   * around each tile. These tile boundaries are useful for debugging.
   *
   * @name showTileBoundaries
   * @type {boolean}
   * @instance
   * @memberof Map
   */
  get showTileBoundaries() {
    return !!this._showTileBoundaries;
  }
  set showTileBoundaries(value) {
    if (this._showTileBoundaries === value) {
      return;
    }
    this._showTileBoundaries = value;
    this._update();
  }

  /**
   * Gets and sets a Boolean indicating whether the map will render boxes
   * around all symbols in the data source, revealing which symbols
   * were rendered or which were hidden due to collisions.
   * This information is useful for debugging.
   *
   * @name showCollisionBoxes
   * @type {boolean}
   * @instance
   * @memberof Map
   */
  get showCollisionBoxes() {
    return !!this._showCollisionBoxes;
  }
  set showCollisionBoxes(value) {
    if (this._showCollisionBoxes === value) {
      return;
    }
    this._showCollisionBoxes = value;
    if (value) {
      // When we turn collision boxes on we have to generate them for existing tiles
      // When we turn them off, there's no cost to leaving existing boxes in place
      this.style._generateCollisionBoxes();
    } else {
      // Otherwise, call an update to remove collision boxes
      this._update();
    }
  }

  /*
   * Gets and sets a Boolean indicating whether the map should color-code
   * each fragment to show how many times it has been shaded.
   * White fragments have been shaded 8 or more times.
   * Black fragments have been shaded 0 times.
   * This information is useful for debugging.
   *
   * @name showOverdraw
   * @type {boolean}
   * @instance
   * @memberof Map
   */
  get showOverdrawInspector() {
    return !!this._showOverdrawInspector;
  }
  set showOverdrawInspector(value) {
    if (this._showOverdrawInspector === value) {
      return;
    }
    this._showOverdrawInspector = value;
    this._update();
  }

  /**
   * Gets and sets a Boolean indicating whether the map will
   * continuously repaint. This information is useful for analyzing performance.
   *
   * @name repaint
   * @type {boolean}
   * @instance
   * @memberof Map
   */
  get repaint() {
    return !!this._repaint;
  }
  set repaint(value) {
    this._repaint = value;
    this._update();
  }

  // show vertices
  get vertices() {
    return !!this._vertices;
  }
  set vertices(value) {
    this._vertices = value;
    this._update();
  }

  _onData(event) {
    this._update(event.dataType === 'style');
    this.fire(new Event(`${event.dataType}data`, event));
  }

  _onDataLoading(event) {
    this.fire(new Event(`${event.dataType}dataloading`, event));
  }
}

export default Map;

function removeNode(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

/**
 * Interface for interactive controls added to the map. This is an
 * specification for implementers to model: it is not
 * an exported method or class.
 *
 * Controls must implement `onAdd` and `onRemove`, and must own an
 * element, which is often a `div` element. To use Mapbox GL JS's
 * default control styling, add the `mapboxgl-ctrl` class to your control's
 * node.
 *
 * @interface IControl
 * @example
 * // Control implemented as ES6 class
 * class HelloWorldControl {
 *     onAdd(map) {
 *         this._map = map;
 *         this._container = document.createElement('div');
 *         this._container.className = 'mapboxgl-ctrl';
 *         this._container.textContent = 'Hello, world';
 *         return this._container;
 *     }
 *
 *     onRemove() {
 *         this._container.parentNode.removeChild(this._container);
 *         this._map = undefined;
 *     }
 * }
 *
 * // Control implemented as ES5 prototypical class
 * function HelloWorldControl() { }
 *
 * HelloWorldControl.prototype.onAdd = function(map) {
 *     this._map = map;
 *     this._container = document.createElement('div');
 *     this._container.className = 'mapboxgl-ctrl';
 *     this._container.textContent = 'Hello, world';
 *     return this._container;
 * };
 *
 * HelloWorldControl.prototype.onRemove = function () {
 *      this._container.parentNode.removeChild(this._container);
 *      this._map = undefined;
 * };
 */

/**
 * Register a control on the map and give it a chance to register event listeners
 * and resources. This method is called by {@link Map#addControl}
 * internally.
 *
 * @function
 * @memberof IControl
 * @instance
 * @name onAdd
 * @param {Map} map the Map this control will be added to
 * @returns {HTMLElement} The control's container element. This should
 * be created by the control and returned by onAdd without being attached
 * to the DOM: the map will insert the control's element into the DOM
 * as necessary.
 */

/**
 * Unregister a control on the map and give it a chance to detach event listeners
 * and resources. This method is called by {@link Map#removeControl}
 * internally.
 *
 * @function
 * @memberof IControl
 * @instance
 * @name onRemove
 * @param {Map} map the Map this control will be removed from
 * @returns {undefined} there is no required return value for this method
 */

/**
 * Optionally provide a default position for this control. If this method
 * is implemented and {@link Map#addControl} is called without the `position`
 * parameter, the value returned by getDefaultPosition will be used as the
 * control's position.
 *
 * @function
 * @memberof IControl
 * @instance
 * @name getDefaultPosition
 * @returns {string} a control position, one of the values valid in addControl.
 */

/**
 * A [`Point` geometry](https://github.com/mapbox/point-geometry) object, which has
 * `x` and `y` properties representing screen coordinates in pixels.
 *
 * @typedef {Object} Point
 */

/**
 * A {@link Point} or an array of two numbers representing `x` and `y` screen coordinates in pixels.
 *
 * @typedef {(Point | Array<number>)} PointLike
 */
