import { Event, Evented } from '@mapwhit/events';
import dynload from 'dynload';
import browser from '../util/browser.js';

/**
 * The possible option of the plugin's status
 *
 * `unavailable`: Not loaded.
 *
 * `deferred`: The plugin URL has been specified, but loading has been deferred.
 *
 * `loading`: request in-flight.
 *
 * `loaded`: The plugin is now loaded
 *
 *  `error`: The plugin failed to load
 */

function RTLPlugin() {
  const self = {
    isRTLSupported
  };

  /**
   * Checks whether the RTL language support is available.
   * If `canChangeShortly` is false, it will only return true if the RTL language
   * is properly supported.
   * If `canChangeShortly` is true, it will also return true if the RTL language
   * is not supported unless it can obtain the RTL text plugin.
   * @param {boolean} canChangeShortly
   * @returns
   */
  function isRTLSupported(canChangeShortly) {
    if (rtlPluginLoader.getRTLTextPluginStatus() === 'loaded') {
      return true;
    }
    if (!canChangeShortly) {
      return false;
    }
    rtlPluginLoader.lazyLoad();
    // any transitive state other than 'loading' means we can consider RTL supported as best as possible for now
    return rtlPluginLoader.getRTLTextPluginStatus() !== 'loading';
  }

  return self;
}

export const rtlPlugin = RTLPlugin();

function RTLPluginLoader() {
  let status = 'unavailable';
  let url;

  const self = {
    getRTLTextPluginStatus,
    setRTLTextPlugin,
    lazyLoad,
    _clearRTLTextPlugin,
    _registerRTLTextPlugin
  };

  /** This one is exposed to outside */
  function getRTLTextPluginStatus() {
    return status;
  }

  // public for testing
  function _clearRTLTextPlugin() {
    url = undefined;
    status = 'unavailable';
    _setMethods();
  }

  function setRTLTextPlugin(pluginURL, deferred = false) {
    if (url) {
      // error
      return Promise.reject(new Error('setRTLTextPlugin cannot be called multiple times.'));
    }
    url = browser.resolveURL(pluginURL);
    if (!url) {
      return Promise.reject(new Error(`requested url ${pluginURL} is invalid`));
    }
    if (status === 'requested') {
      return _downloadRTLTextPlugin();
    }
    if (status === 'unavailable') {
      // from initial state:
      if (!deferred) {
        return _downloadRTLTextPlugin();
      }
      status = 'deferred';
    }
  }

  async function _downloadRTLTextPlugin() {
    status = 'loading';
    try {
      await rtlPluginLoader._loadScript({ url });
    } catch {
      status = 'error';
    }
    rtlPluginLoader.fire(new Event('RTLPluginLoaded'));
  }

  /** Start a lazy loading process of RTL plugin */
  function lazyLoad() {
    if (status === 'unavailable') {
      status = 'requested';
      return;
    }
    if (status === 'deferred') {
      return _downloadRTLTextPlugin();
    }
  }

  function _setMethods(rtlTextPlugin) {
    if (!rtlTextPlugin) {
      // for testing only
      rtlPlugin.processStyledBidirectionalText = null;
      rtlPlugin.processBidirectionalText = null;
      rtlPlugin.applyArabicShaping = null;
      return;
    }
    rtlPlugin.applyArabicShaping = rtlTextPlugin.applyArabicShaping;
    rtlPlugin.processBidirectionalText = rtlTextPlugin.processBidirectionalText;
    rtlPlugin.processStyledBidirectionalText = rtlTextPlugin.processStyledBidirectionalText;
  }

  // This is invoked by the RTL text plugin when the download has finished, and the code has been parsed.
  function _registerRTLTextPlugin(rtlTextPlugin) {
    if (rtlPlugin.isRTLSupported()) {
      throw new Error('RTL text plugin already registered.');
    }
    status = 'loaded';
    _setMethods(rtlTextPlugin);
  }

  return self;
}

// public for testing
function _loadScript({ url }) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const s = dynload(url);
  s.onload = () => resolve();
  s.onerror = () => reject(true);
  return promise;
}

const { getRTLTextPluginStatus, setRTLTextPlugin, lazyLoad, _clearRTLTextPlugin, _registerRTLTextPlugin } =
  RTLPluginLoader();

globalThis.registerRTLTextPlugin ??= _registerRTLTextPlugin;

export const rtlPluginLoader = Object.assign(new Evented(), {
  getRTLTextPluginStatus,
  setRTLTextPlugin,
  lazyLoad,
  _clearRTLTextPlugin,
  _loadScript
});
