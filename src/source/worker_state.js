const StyleLayerIndex = require('../style/style_layer_index');
const { resources } = require('./resources');
const { plugin: globalRTLTextPlugin } = require('./rtl_text_plugin');

class WorkerState {
  #opts;
  #resources = {};
  #layerIndexes = {};

  constructor(opts) {
    this.#opts = opts;
  }

  async loadRTLTextPlugin(mapId, pluginURL) {
    if (!globalRTLTextPlugin.isLoaded()) {
      await loadScript(pluginURL);
      if (!globalRTLTextPlugin.isLoaded()) {
        throw new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`);
      }
    }
  }

  setLayers(mapId, layers) {
    this.getLayerIndex(mapId).replace(layers);
  }

  updateLayers(mapId, params) {
    this.getLayerIndex(mapId).update(params.layers, params.removedIds);
  }

  getLayerIndex(mapId) {
    return (this.#layerIndexes[mapId] ??= new StyleLayerIndex());
  }

  getResources(mapId) {
    return (this.#resources[mapId] ??= resources(this.#opts));
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

// FIXME: implement script loading
async function loadScript() {}

module.exports = WorkerState;
