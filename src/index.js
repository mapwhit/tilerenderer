import './util/polyfill.js';

import packageJSON from '../package.json' with { type: 'json' };
import config from './util/config.js';

import { default as Point } from '@mapbox/point-geometry';
import { Evented } from '@mapwhit/events';
import { default as LngLat } from './geo/lng_lat.js';
import { default as LngLatBounds } from './geo/lng_lat_bounds.js';
import { setRTLTextPlugin } from './source/rtl_text_plugin.js';
import { default as Style } from './style/style.js';
import { default as Map } from './ui/map.js';

const { version } = packageJSON;

export { version, config, setRTLTextPlugin, Point, LngLat, LngLatBounds, Style, Map, Evented };

// for commonjs backward compatibility
const mapwhit = {
  version,
  config,
  setRTLTextPlugin,
  Point,
  LngLat,
  LngLatBounds,
  Style,
  Map,
  Evented
};

const properties = {
  workerCount: {
    get() {
      return config.WORKER_COUNT;
    },
    set(count) {
      config.WORKER_COUNT = count;
    }
  },
  workerUrl: {
    get() {
      return config.WORKER_URL;
    },
    set(url) {
      config.WORKER_URL = url;
    }
  }
};

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
 * @param {Function} callback Called with an error argument if there is an error.
 * @example
 * mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.0/mapbox-gl-rtl-text.js');
 * @see [Add support for right-to-left scripts](https://www.mapbox.com/mapbox-gl-js/example/mapbox-gl-rtl-text/)
 */

// canary assert: used to confirm that asserts have been removed from production build
import assert from 'assert';

assert(true, 'canary assert');
