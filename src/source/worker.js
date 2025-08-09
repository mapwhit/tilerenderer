require('../util/polyfill');

const Actor = require('../util/actor');

const StyleLayerIndex = require('../style/style_layer_index');
const VectorTileWorkerSource = require('./vector_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const assert = require('assert');
const { plugin: globalRTLTextPlugin } = require('./rtl_text_plugin');
const { resources } = require('./resources');

class Worker {
  #resources = {};

  constructor(self) {
    this.self = self;
    this.actor = new Actor(self, this);

    this.actors = {};
    this.layerIndexes = {};

    this.workerSourceTypes = {
      vector: VectorTileWorkerSource,
      geojson: GeoJSONWorkerSource
    };

    // [mapId][sourceType][sourceName] => worker source instance
    this.workerSources = {};

    this.self.registerWorkerSource = (name, WorkerSource) => {
      if (this.workerSourceTypes[name]) {
        throw new Error(`Worker source with name "${name}" already registered.`);
      }
      this.workerSourceTypes[name] = WorkerSource;
    };

    this.self.registerRTLTextPlugin = rtlTextPlugin => {
      if (globalRTLTextPlugin.isLoaded()) {
        throw new Error('RTL text plugin already registered.');
      }
      globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
      globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
      globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;
    };
  }

  setLayers(mapId, layers) {
    this.getLayerIndex(mapId).replace(layers);
  }

  updateLayers(mapId, params) {
    this.getLayerIndex(mapId).update(params.layers, params.removedIds);
  }

  loadTile(mapId, params) {
    assert(params.type);
    return this.getWorkerSource(mapId, params.type, params.source).loadTile(params);
  }

  removeSource(mapId, params) {
    const { type, source } = params;
    assert(type);
    assert(source);

    const worker = this.workerSources?.[mapId]?.[type]?.[source];
    if (worker) {
      delete this.workerSources[mapId][type][source];
      worker.removeSource?.(params);
    }
  }

  loadRTLTextPlugin(map, pluginURL) {
    if (!globalRTLTextPlugin.isLoaded()) {
      this.self.importScripts(pluginURL);
      if (!globalRTLTextPlugin.isLoaded()) {
        throw new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`);
      }
    }
  }

  getLayerIndex(mapId) {
    return (this.layerIndexes[mapId] ??= new StyleLayerIndex());
  }

  getResources(mapId) {
    return (this.#resources[mapId] ??= resources(this.actor, mapId));
  }

  getWorkerSource(mapId, type, source) {
    this.workerSources[mapId] ??= {};
    this.workerSources[mapId][type] ??= {};

    return (this.workerSources[mapId][type][source] ??= this.createWorkerSource(type, mapId));
  }

  createWorkerSource(type, mapId) {
    const WorkerSource = this.workerSourceTypes[type];
    return new WorkerSource(this.getResources(mapId), this.getLayerIndex(mapId));
  }
}

module.exports = function createWorker(self) {
  return new Worker(self);
};
