require('../util/polyfill');

const Actor = require('../util/actor');

const StyleLayerIndex = require('../style/style_layer_index');
const VectorTileWorkerSource = require('./vector_tile_worker_source');
const RasterDEMTileWorkerSource = require('./raster_dem_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const assert = require('assert');
const { plugin: globalRTLTextPlugin } = require('./rtl_text_plugin');

class Worker {
  constructor(self) {
    this.self = self;
    this.actor = new Actor(self, this);

    this.layerIndexes = {};

    this.workerSourceTypes = {
      vector: VectorTileWorkerSource,
      geojson: GeoJSONWorkerSource
    };

    // [mapId][sourceType][sourceName] => worker source instance
    this.workerSources = {};
    this.demWorkerSources = {};

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

  loadDEMTile(mapId, params) {
    return this.getDEMWorkerSource(mapId, params.source).loadTile(params);
  }

  reloadTile(mapId, params) {
    assert(params.type);
    return this.getWorkerSource(mapId, params.type, params.source).reloadTile(params);
  }

  removeTile(mapId, params) {
    assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).removeTile(params);
  }

  removeDEMTile(mapId, params) {
    this.getDEMWorkerSource(mapId, params.source).removeTile(params);
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

  /**
   * Load a {@link WorkerSource} script at params.url.  The script is run
   * (using importScripts) with `registerWorkerSource` in scope, which is a
   * function taking `(name, workerSourceObject)`.
   *  @private
   */
  loadWorkerSource(map, params) {
    this.self.importScripts(params.url);
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

  getWorkerSource(mapId, type, source) {
    this.workerSources[mapId] ??= {};
    this.workerSources[mapId][type] ??= {};

    let s = this.workerSources[mapId][type][source];
    if (!s) {
      // use a wrapped actor so that we can attach a target mapId param
      // to any messages invoked by the WorkerSource
      const actor = {
        send: (type, data) => this.actor.send(type, data, mapId)
      };

      const WorkerSource = this.workerSourceTypes[type];
      s = this.workerSources[mapId][type][source] = new WorkerSource(actor, this.getLayerIndex(mapId));
    }

    return s;
  }

  getDEMWorkerSource(mapId, source) {
    this.demWorkerSources[mapId] ??= {};
    return (this.demWorkerSources[mapId][source] ??= new RasterDEMTileWorkerSource());
  }
}

module.exports = function createWorker(self) {
  return new Worker(self);
};
