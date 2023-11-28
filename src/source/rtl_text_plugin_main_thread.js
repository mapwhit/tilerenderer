import { Event, Evented } from '@mapwhit/events';
import dynload from 'dynload';
import browser from '../util/browser.js';
import { rtlWorkerPlugin } from './rtl_text_plugin_worker.js';

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

class RTLMainThreadPlugin extends Evented {
  pluginStatus = 'unavailable';
  pluginURL = null;
  queue = [];
  _sendPluginStateToWorker() {
    syncRTLPluginState({
      pluginStatus: this.pluginStatus,
      pluginURL: this.pluginURL
    });
    this.fire(new Event('pluginStateChange', { pluginStatus: this.pluginStatus, pluginURL: this.pluginURL }));
  }
  getRTLTextPluginStatus() {
    return this.pluginStatus;
  }
  // public for testing
  clearRTLTextPlugin() {
    this.pluginStatus = 'unavailable';
    this.pluginURL = null;
  }
  // public for testing
  loadScript({ url }) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const s = dynload(url);
    s.onload = () => resolve();
    s.onerror = () => reject(true);
    return promise;
  }
  async setRTLTextPlugin(url, deferred = false) {
    if (this.pluginStatus === 'deferred' || this.pluginStatus === 'loading' || this.pluginStatus === 'loaded') {
      throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    this.pluginURL = browser.resolveURL(url);
    this.pluginStatus = 'deferred';
    this._sendPluginStateToWorker();
    if (!deferred) {
      //Start downloading the plugin immediately if not intending to lazy-load
      await this._downloadRTLTextPlugin();
    }
  }
  async _downloadRTLTextPlugin() {
    if (this.pluginStatus !== 'deferred' || !this.pluginURL) {
      throw new Error('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
    }
    try {
      this.pluginStatus = 'loading';
      this._sendPluginStateToWorker();
      await this.loadScript({ url: this.pluginURL });
    } catch {
      this.pluginStatus = 'error';
      this._sendPluginStateToWorker();
    }
  }
  async lazyLoadRTLTextPlugin() {
    if (this.pluginStatus === 'deferred') {
      await this._downloadRTLTextPlugin();
    }
  }
}
let rtlMainThreadPlugin = null;
export function rtlMainThreadPluginFactory() {
  if (!rtlMainThreadPlugin) {
    rtlMainThreadPlugin = new RTLMainThreadPlugin();
  }
  return rtlMainThreadPlugin;
}

function syncRTLPluginState(state) {
  rtlWorkerPlugin.setState(state);
}

// This is invoked by the RTL text plugin when the download via the `importScripts` call has finished, and the code has been parsed.
function registerRTLTextPlugin(rtlTextPlugin) {
  if (rtlWorkerPlugin.isParsed()) {
    throw new Error('RTL text plugin already registered.');
  }
  const rtlMainThreadPlugin = rtlMainThreadPluginFactory();
  rtlMainThreadPlugin.pluginStatus = 'loaded';
  rtlMainThreadPlugin._sendPluginStateToWorker();
  rtlWorkerPlugin.setMethods(rtlTextPlugin);
}

globalThis.registerRTLTextPlugin ??= registerRTLTextPlugin;
