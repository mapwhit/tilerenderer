// 

import { Event, Evented } from '../util/evented';

let pluginRequested = false;
let pluginURL = null;
let foregroundLoadComplete = false;

export const evented = new Evented();


let _completionCallback;

export const registerForPluginAvailability = function(
    callback
) {
    if (pluginURL) {
        callback({ pluginURL: pluginURL, completionCallback: _completionCallback});
    } else {
        evented.once('pluginAvailable', callback);
    }
    return callback;
};

export const clearRTLTextPlugin = function() {
    pluginRequested = false;
    pluginURL = null;
};

export const setRTLTextPlugin = function(url, callback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    pluginURL = url;
    _completionCallback = (error) => {
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
};

export const plugin = {
    applyArabicShaping: null,
    processBidirectionalText: null,
    isLoaded: function() {
        return foregroundLoadComplete ||       // Foreground: loaded if the completion callback returned successfully
            plugin.applyArabicShaping != null; // Background: loaded if the plugin functions have been compiled
    }
};
