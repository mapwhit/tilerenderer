import dynload from 'dynload';
import browser from '../util/browser.js';

const status = {
  unavailable: 'unavailable', // Not loaded
  deferred: 'deferred', // The plugin URL has been specified, but loading has been deferred
  loading: 'loading', // request in-flight
  loaded: 'loaded',
  error: 'error'
};

let _completionCallback;

//Variables defining the current state of the plugin
let pluginStatus = status.unavailable;
let pluginURL;

const _loadedCallbacks = [];

const rtlPlugin = {
  clearRTLTextPlugin, // exported for testing
  loadScript, // exported for testing
  registerForPluginStateChange,
  setRTLTextPlugin
};

export function getRTLTextPluginStatus() {
  return pluginStatus;
}

export function registerForPluginStateChange(callback) {
  if (plugin.isLoaded()) {
    callback();
    return;
  }
  _loadedCallbacks.push(callback);
  downloadRTLTextPlugin();
  return () => _loadedCallbacks.splice(_loadedCallbacks.indexOf(callback), 1);
}

export function clearRTLTextPlugin() {
  _loadedCallbacks.length = 0;
  pluginStatus = status.unavailable;
  pluginURL = undefined;
}

export function setRTLTextPlugin(url, callback, deferred = false) {
  if (pluginStatus === status.deferred || pluginStatus === status.loading || pluginStatus === status.loaded) {
    throw new Error('setRTLTextPlugin cannot be called multiple times.');
  }
  pluginURL = browser.resolveURL(url);
  pluginStatus = status.deferred;
  _completionCallback = error => {
    if (error) {
      const msg = `RTL Text Plugin failed to load scripts from ${pluginURL}`;
      // Clear loaded state to allow retries
      clearRTLTextPlugin();
      pluginStatus = status.error;
      error = new Error(msg);
    } else {
      pluginStatus = status.loaded;
    }
    if (callback) {
      callback(error);
    }
    _completionCallback = undefined;
  };
  //Start downloading the plugin immediately if not intending to lazy-load
  if (!deferred) {
    downloadRTLTextPlugin();
  }
}

export function downloadRTLTextPlugin() {
  if (pluginURL && !plugin.isLoading() && !plugin.isLoaded() && _loadedCallbacks.length > 0) {
    pluginStatus = status.loading;
    // needs to be called as exported method for mock testing
    rtlPlugin.loadScript(pluginURL).then(_completionCallback).catch(_completionCallback);
  }
}

function registerRTLTextPlugin(loadedPlugin) {
  if (plugin.isLoaded()) {
    throw new Error('RTL text plugin already registered.');
  }
  plugin['applyArabicShaping'] = loadedPlugin.applyArabicShaping;
  plugin['processBidirectionalText'] = loadedPlugin.processBidirectionalText;
  plugin['processStyledBidirectionalText'] = loadedPlugin.processStyledBidirectionalText;

  if (_completionCallback) {
    _completionCallback();
  }
  _loadedCallbacks.forEach(callback => callback());
  _loadedCallbacks.length = 0;
}

globalThis.registerRTLTextPlugin ??= registerRTLTextPlugin;

function loadScript(url) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const s = dynload(url);
  s.onload = () => resolve();
  s.onerror = () => reject(true);
  return promise;
}

export const plugin = (rtlPlugin.plugin = {
  applyArabicShaping: null,
  processBidirectionalText: null,
  processStyledBidirectionalText: null,
  // loaded if the completion callback returned successfully or the plugin functions have been compiled
  isLoaded: () => pluginStatus === status.loaded || plugin.applyArabicShaping != null,
  // query the loading status
  isLoading: () => pluginStatus === status.loading,
  isParsed: () =>
    plugin.applyArabicShaping != null &&
    plugin.processBidirectionalText != null &&
    plugin.processStyledBidirectionalText != null
});

export default rtlPlugin;
