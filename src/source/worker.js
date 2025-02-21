const Actor = require('../util/actor');

const StyleLayerIndex = require('../style/style_layer_index');
const VectorTileWorkerSource = require('./vector_tile_worker_source');
const RasterDEMTileWorkerSource = require('./raster_dem_tile_worker_source');
const GeoJSONWorkerSource = require('./geojson_worker_source');
const assert = require('assert');
const { plugin: globalRTLTextPlugin } = require('./rtl_text_plugin');

/**
 * @private
 */
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

  setLayers(mapId, layers, callback) {
    this.getLayerIndex(mapId).replace(layers);
    callback();
  }

  updateLayers(mapId, params, callback) {
    this.getLayerIndex(mapId).update(params.layers, params.removedIds);
    callback();
  }

  loadTile(mapId, params, callback) {
    assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).loadTile(params, callback);
  }

  loadDEMTile(mapId, params, callback) {
    this.getDEMWorkerSource(mapId, params.source).loadTile(params, callback);
  }

  reloadTile(mapId, params, callback) {
    assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).reloadTile(params, callback);
  }

  removeTile(mapId, params, callback) {
    assert(params.type);
    this.getWorkerSource(mapId, params.type, params.source).removeTile(params, callback);
  }

  removeDEMTile(mapId, params) {
    this.getDEMWorkerSource(mapId, params.source).removeTile(params);
  }

  removeSource(mapId, params, callback) {
    assert(params.type);
    assert(params.source);

    if (
      !this.workerSources[mapId] ||
      !this.workerSources[mapId][params.type] ||
      !this.workerSources[mapId][params.type][params.source]
    ) {
      return;
    }

    const worker = this.workerSources[mapId][params.type][params.source];
    delete this.workerSources[mapId][params.type][params.source];

    if (worker.removeSource !== undefined) {
      worker.removeSource(params, callback);
    } else {
      callback();
    }
  }

  /**
   * Load a {@link WorkerSource} script at params.url.  The script is run
   * (using importScripts) with `registerWorkerSource` in scope, which is a
   * function taking `(name, workerSourceObject)`.
   *  @private
   */
  loadWorkerSource(map, params, callback) {
    try {
      this.self.importScripts(params.url);
      callback();
    } catch (e) {
      callback(e.toString());
    }
  }

  loadRTLTextPlugin(map, pluginURL, callback) {
    try {
      if (!globalRTLTextPlugin.isLoaded()) {
        this.self.importScripts(pluginURL);
        callback(
          globalRTLTextPlugin.isLoaded()
            ? null
            : new Error(`RTL Text Plugin failed to import scripts from ${pluginURL}`)
        );
      }
    } catch (e) {
      callback(e.toString());
    }
  }

  getLayerIndex(mapId) {
    let layerIndexes = this.layerIndexes[mapId];
    if (!layerIndexes) {
      layerIndexes = this.layerIndexes[mapId] = new StyleLayerIndex();
    }
    return layerIndexes;
  }

  getWorkerSource(mapId, type, source) {
    if (!this.workerSources[mapId]) this.workerSources[mapId] = {};
    if (!this.workerSources[mapId][type]) this.workerSources[mapId][type] = {};

    if (!this.workerSources[mapId][type][source]) {
      // use a wrapped actor so that we can attach a target mapId param
      // to any messages invoked by the WorkerSource
      const actor = {
        send: (type, data, callback) => this.actor.send(type, data, callback, mapId)
      };

      this.workerSources[mapId][type][source] = new this.workerSourceTypes[type](actor, this.getLayerIndex(mapId));
    }

    return this.workerSources[mapId][type][source];
  }

  getDEMWorkerSource(mapId, source) {
    if (!this.demWorkerSources[mapId]) this.demWorkerSources[mapId] = {};

    if (!this.demWorkerSources[mapId][source]) {
      this.demWorkerSources[mapId][source] = new RasterDEMTileWorkerSource();
    }

    return this.demWorkerSources[mapId][source];
  }
}

module.exports = function createWorker(self) {
  return new Worker(self);
};
