import './util/polyfill.js';

import { Evented } from '@mapwhit/events';
import { Point } from '@mapwhit/point-geometry';
import packageJSON from '../package.json' with { type: 'json' };
import { default as LngLat } from './geo/lng_lat.js';
import { default as LngLatBounds } from './geo/lng_lat_bounds.js';
import { rtlPluginLoader } from './source/rtl_text_plugin.js';
import { default as Style } from './style/style.js';
import { default as Map } from './ui/map.js';
import config from './util/config.js';

const { version } = packageJSON;

export { version, config, setRTLTextPlugin, getRTLTextPluginStatus, Point, LngLat, LngLatBounds, Style, Map, Evented };

// for commonjs backward compatibility
const mapwhit = {
  version,
  config,
  setRTLTextPlugin,
  getRTLTextPluginStatus,
  Point,
  LngLat,
  LngLatBounds,
  Style,
  Map,
  Evented
};

const properties = {};

Object.defineProperties(mapwhit, properties);
Object.defineProperties(config, properties);

export default mapwhit;

/**
 * The version of Mapbox GL JS in use as specified in `package.json`,
 * `CHANGELOG.md`, and the GitHub release.
 *
 * @var {string} version
 */

/**
 * Sets the map's [RTL text plugin](https://github.com/mapwhit/rtl-text).
 * Necessary for supporting languages like Arabic and Hebrew that are written right-to-left.
 *
 * @function setRTLTextPlugin
 * @param {function} loadPlugin a function that returns a Promise resolving to object
 *   with RTL text plugin methods `applyArabicShaping`, `processBidirectionalText`,
 *   and `processStyledBidirectionalText`.
 * @param {boolean} lazy If set to `true`, loading the plugin will defer until rtl text is encountered,
 *    rtl text will then be rendered only after the plugin finishes loading.
 * @example
 * ```javascript
 * import loadRTLTextPlugin from '@mapwhit/rtl-text';
 * setRTLTextPlugin(loadRTLTextPlugin, true);
 * ```
 * @see [Add support for right-to-left scripts](https://maplibre.org/maplibre-gl-js/docs/examples/mapbox-gl-rtl-text/)
 */
function setRTLTextPlugin(loadPlugin, lazy) {
  return rtlPluginLoader.setRTLTextPlugin(loadPlugin, lazy);
}
/**
 * Gets the map's [RTL text plugin](https://github.com/mapwhit/rtl-text) status.
 * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
 * If the status is `loaded` and the plugin is requested again, an error will be thrown.
 *
 * @function getRTLTextPluginStatus
 * @example
 * const pluginStatus = getRTLTextPluginStatus();
 */
function getRTLTextPluginStatus() {
  return rtlPluginLoader.getRTLTextPluginStatus();
}

// canary assert: used to confirm that asserts have been removed from production build
import assert from 'assert';

assert(true, 'canary assert');
