import './util/polyfill.js';

import { Evented } from '@mapwhit/events';
import { Point } from '@mapwhit/point-geometry';
import packageJSON from '../package.json' with { type: 'json' };
import { default as LngLat } from './geo/lng_lat.js';
import { default as LngLatBounds } from './geo/lng_lat_bounds.js';
import { rtlMainThreadPluginFactory } from './source/rtl_text_plugin_main_thread.js';
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
 * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
 * Necessary for supporting languages like Arabic and Hebrew that are written right-to-left.
 *
 * @function setRTLTextPlugin
 * @param {string} pluginURL URL pointing to the Mapbox RTL text plugin source.
 * @param {boolean} lazy If set to `true`, mapboxgl will defer loading the plugin until rtl text is encountered,
 *    rtl text will then be rendered only after the plugin finishes loading.
 * @example
 * setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js', false);
 * @see [Add support for right-to-left scripts](https://maplibre.org/maplibre-gl-js/docs/examples/mapbox-gl-rtl-text/)
 */
function setRTLTextPlugin(pluginURL, lazy) {
  return rtlMainThreadPluginFactory().setRTLTextPlugin(pluginURL, lazy);
}
/**
 * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
 * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
 * If the status is `loaded` and the plugin is requested again, an error will be thrown.
 *
 * @function getRTLTextPluginStatus
 * @example
 * const pluginStatus = getRTLTextPluginStatus();
 */
function getRTLTextPluginStatus() {
  return rtlMainThreadPluginFactory().getRTLTextPluginStatus();
}

// canary assert: used to confirm that asserts have been removed from production build
import assert from 'assert';

assert(true, 'canary assert');
