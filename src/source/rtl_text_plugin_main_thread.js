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
  status = 'unavailable';
  url = null;
  queue = [];
  _syncState(statusToSend) {
    this.status = statusToSend;
    syncRTLPluginState({
      pluginStatus: this.status,
      pluginURL: this.url
    });
  }

  /** This one is exposed to outside */
  getRTLTextPluginStatus() {
    return this.status;
  }

  // public for testing
  clearRTLTextPlugin() {
    this.status = 'unavailable';
    this.url = null;
  }

  // public for testing
  loadScript({ url }) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const s = dynload(url);
    s.onload = () => resolve();
    s.onerror = () => reject(true);
    return promise;
  }

  setRTLTextPlugin(url, deferred = false) {
    if (this.url) {
      // error
      return Promise.reject(new Error('setRTLTextPlugin cannot be called multiple times.'));
    }
    this.url = browser.resolveURL(url);
    if (!this.url) {
      return Promise.reject(new Error(`requested url ${url} is invalid`));
    }
    if (this.status === 'requested') {
      return this._downloadRTLTextPlugin();
    }
    if (this.status === 'unavailable') {
      // from initial state:
      if (!deferred) {
        return this._downloadRTLTextPlugin();
      }
      this.status = 'deferred';
      // fire and forget: in this case it does not need wait for the broadcasting result
      // it is important to sync the deferred status once because
      // symbol_bucket will be checking it in worker
      this._syncState(this.status);
    }
  }

  async _downloadRTLTextPlugin() {
    this._syncState('loading');
    try {
      await this.loadScript({ url: this.url });
      this.fire(new Event('RTLPluginLoaded'));
    } catch {
      this.status = 'error';
      this._syncState(this.status);
      throw new Error(`RTL Text Plugin failed to import scripts from ${this.url}`);
    }
  }

  /** Start a lazy loading process of RTL plugin */
  lazyLoad() {
    if (this.status === 'unavailable') {
      this.status = 'requested';
      this._syncState(this.status);
    } else if (this.status === 'deferred') {
      return this._downloadRTLTextPlugin();
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
  rtlMainThreadPlugin.status = 'loaded';
  rtlMainThreadPlugin._syncState(rtlMainThreadPlugin.status);
  rtlWorkerPlugin.setMethods(rtlTextPlugin);
}

globalThis.registerRTLTextPlugin ??= registerRTLTextPlugin;
