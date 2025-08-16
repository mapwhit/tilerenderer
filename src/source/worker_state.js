const dynload = require('dynload');
const { plugin: globalRTLTextPlugin } = require('./rtl_text_plugin');

class WorkerState {
  async loadRTLTextPlugin(mapId, pluginURL) {
    if (!globalRTLTextPlugin.isLoaded()) {
      await loadScript(pluginURL);
    }
  }
}

function registerRTLTextPlugin(rtlTextPlugin) {
  if (globalRTLTextPlugin.isLoaded()) {
    throw new Error('RTL text plugin already registered.');
  }
  globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
  globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
  globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
}

globalThis.registerRTLTextPlugin ??= registerRTLTextPlugin;

async function loadScript(url) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const s = dynload(url);
  s.onload = () => resolve();
  s.onerror = () => reject(new Error(`RTL Text Plugin failed to import scripts from ${url}`));
  return promise;
}

module.exports = WorkerState;
