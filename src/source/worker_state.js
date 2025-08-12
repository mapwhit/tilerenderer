const StyleLayerIndex = require('../style/style_layer_index');
const { resources } = require('./resources');

class WorkerState {
  #resources = {};
  #layerIndexes = {};

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
    return (this.#resources[mapId] ??= resources(this.actor, mapId));
  }
}

module.exports = WorkerState;
