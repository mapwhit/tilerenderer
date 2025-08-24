import dynload from 'dynload';
import browser from '../util/browser.js';

let pluginRequested = false;
let pluginURL;
let loading = false;

let _completionCallback;
const _loadedCallbacks = [];

const rtlPlugin = {
  clearRTLTextPlugin, // exported for testing
  loadScript, // exported for testing
  registerForPluginAvailability,
  setRTLTextPlugin
};

export function registerForPluginAvailability(callback) {
  if (plugin.isLoaded()) {
    callback();
    return;
  }
  _loadedCallbacks.push(callback);
  loadRTLTextPlugin();
  return () => _loadedCallbacks.splice(_loadedCallbacks.indexOf(callback), 1);
}

export function clearRTLTextPlugin() {
  _loadedCallbacks.length = 0;
  pluginRequested = false;
  pluginURL = undefined;
}

export function setRTLTextPlugin(url, callback) {
  if (pluginRequested) {
    throw new Error('setRTLTextPlugin cannot be called multiple times.');
  }
  pluginRequested = true;
  pluginURL = browser.resolveURL(url);
  _completionCallback = error => {
    if (error) {
      const msg = `RTL Text Plugin failed to load scripts from ${pluginURL}`;
      // Clear loaded state to allow retries
      clearRTLTextPlugin();
      if (callback) {
        callback(new Error(msg));
      }
    }
    loading = false;
    _completionCallback = undefined;
  };
  loadRTLTextPlugin();
}

function loadRTLTextPlugin() {
  if (pluginURL && !plugin.isLoaded() && _loadedCallbacks.length > 0 && !loading) {
    // needs to be called as exported method for mock testing
    loading = rtlPlugin.loadScript(pluginURL).catch(_completionCallback);
  }
}

function registerRTLTextPlugin(loadedPlugin) {
  if (plugin.isLoaded()) {
    throw new Error('RTL text plugin already registered.');
  }
  plugin['applyArabicShaping'] = loadedPlugin.applyArabicShaping;
  plugin['processBidirectionalText'] = loadedPlugin.processBidirectionalText;
  plugin['processStyledBidirectionalText'] = loadedPlugin.processStyledBidirectionalText;

  _completionCallback();
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
  isLoaded: () => plugin.applyArabicShaping != null
});

export default rtlPlugin;
