require('./util/polyfill');

module.exports = {
  version: require('../package.json').version,
  setRTLTextPlugin: require('./source/rtl_text_plugin').setRTLTextPlugin,
  Map: require('./ui/map'),
  Style: require('./style/style'),
  LngLat: require('./geo/lng_lat'),
  LngLatBounds: require('./geo/lng_lat_bounds'),
  Point: require('@mapbox/point-geometry'),
  Evented: require('./util/evented').Evented,
  config: require('./util/config'),

  get workerCount() {
    return this.config.WORKER_COUNT;
  },

  set workerCount(count) {
    this.config.WORKER_COUNT = count;
  },

  get workerUrl() {
    return this.config.WORKER_URL;
  },

  set workerUrl(url) {
    this.config.WORKER_URL = url;
  }
};

/**
 * The version of Mapbox GL JS in use as specified in `package.json`,
 * `CHANGELOG.md`, and the GitHub release.
 *
 * @var {string} version
 */

/**
 * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
 * Necessary for supporting languages like Arabic and Hebrew that are written right-to-left.
 *
 * @function setRTLTextPlugin
 * @param {string} pluginURL URL pointing to the Mapbox RTL text plugin source.
 * @param {Function} callback Called with an error argument if there is an error.
 * @example
 * mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.1.2/mapbox-gl-rtl-text.js');
 * @see [Add support for right-to-left scripts](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-rtl-text/)
 */

// canary assert: used to confirm that asserts have been removed from production build
const assert = require('assert');
assert(true, 'canary assert');
