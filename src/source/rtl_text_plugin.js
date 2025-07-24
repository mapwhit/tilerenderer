const { Event, Evented } = require('@mapwhit/events');
const browser = require('../util/browser');

let pluginRequested = false;
let pluginURL = null;
let foregroundLoadComplete = false;

const evented = new Evented();

let _completionCallback;

function registerForPluginAvailability(callback) {
  if (pluginURL) {
    callback({ pluginURL: pluginURL, completionCallback: _completionCallback });
  } else {
    evented.once('pluginAvailable', callback);
  }
  return callback;
}

function clearRTLTextPlugin() {
  pluginRequested = false;
  pluginURL = null;
}

function setRTLTextPlugin(url, callback) {
  if (pluginRequested) {
    throw new Error('setRTLTextPlugin cannot be called multiple times.');
  }
  pluginRequested = true;
  pluginURL = browser.resolveURL(url);
  _completionCallback = error => {
    if (error) {
      // Clear loaded state to allow retries
      clearRTLTextPlugin();
      if (callback) {
        callback(error);
      }
    } else {
      // Called once for each worker
      foregroundLoadComplete = true;
    }
  };
  evented.fire(new Event('pluginAvailable', { pluginURL: pluginURL, completionCallback: _completionCallback }));
}

const plugin = {
  applyArabicShaping: null,
  processBidirectionalText: null,
  processStyledBidirectionalText: null,
  isLoaded: function () {
    return (
      foregroundLoadComplete || // Foreground: loaded if the completion callback returned successfully
      plugin.applyArabicShaping != null
    ); // Background: loaded if the plugin functions have been compiled
  }
};

module.exports = {
  registerForPluginAvailability,
  clearRTLTextPlugin,
  setRTLTextPlugin,
  plugin,
  evented
};
