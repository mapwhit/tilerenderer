const createStyleLayer = require('./create_style_layer');

const { values } = require('../util/object');
const featureFilter = require('../style-spec/feature_filter');
const groupByLayout = require('../style-spec/group_by_layout');

class StyleLayerIndex {
  #layerConfigs = {};
  #layers = {};

  constructor(layerConfigs) {
    if (layerConfigs) {
      this.update(layerConfigs);
    }
  }

  replace(layerConfigs) {
    this.#layerConfigs = {};
    this.#layers = {};
    this.update(layerConfigs);
  }

  update(layerConfigs, removedIds = []) {
    for (const layerConfig of layerConfigs) {
      this.#layerConfigs[layerConfig.id] = layerConfig;

      const layer = (this.#layers[layerConfig.id] = createStyleLayer(layerConfig));
      layer._featureFilter = featureFilter(layer.filter);
    }
    for (const id of removedIds) {
      delete this.#layerConfigs[id];
      delete this.#layers[id];
    }

    this.familiesBySource = {};

    const groups = groupByLayout(values(this.#layerConfigs));

    for (const layerConfigs of groups) {
      const layers = layerConfigs.map(layerConfig => this.#layers[layerConfig.id]);

      const layer = layers[0];
      if (layer.visibility === 'none') {
        continue;
      }

      const { source = '', sourceLayer = '_geojsonTileLayer' } = layer;
      const sourceGroup = (this.familiesBySource[source] ??= {});
      const sourceLayerFamilies = (sourceGroup[sourceLayer] ??= []);
      sourceLayerFamilies.push(layers);
    }
  }
}

module.exports = StyleLayerIndex;
