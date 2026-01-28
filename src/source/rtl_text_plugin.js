import { Event, Evented } from '@mapwhit/events';

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
  let load;

  const self = {
    getRTLTextPluginStatus,
    setRTLTextPlugin,
    lazyLoad,
    _clearRTLTextPlugin
  };

  /** This one is exposed to outside */
  function getRTLTextPluginStatus() {
    return status;
  }

  // public for testing
  function _clearRTLTextPlugin() {
    status = 'unavailable';
    load = undefined;
    _setMethods();
  }

  function setRTLTextPlugin(pluginLoad, deferred = false) {
    if (load) {
      // error
      return Promise.reject(new Error('setRTLTextPlugin cannot be called multiple times.'));
    }
    load = pluginLoad;
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
    if (typeof load !== 'function') {
      return Promise.reject(new Error('RTL text plugin load function is not set.'));
    }
    status = 'loading';
    try {
      _setMethods(await load());
      status = 'loaded';
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

  return self;
}

export const rtlPluginLoader = Object.assign(new Evented(), RTLPluginLoader());
