const createStyleLayer = require('./create_style_layer');

const { values } = require('../util/object');
const featureFilter = require('../style-spec/feature_filter');
const groupByLayout = require('../style-spec/group_by_layout');

class StyleLayerIndex {
  #layerConfigs = {};
  #layers = {};
  #fbs = {};

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

    this.#fbs = null;
  }

  get familiesBySource() {
    if (!this.#fbs) {
      this.#fbs = calculateFamiliesBySource(this.#layers, this.#layerConfigs);
    }
    return this.#fbs;
  }
}

function calculateFamiliesBySource(layers, layerConfigs) {
  const familiesBySource = {};
  const groups = groupByLayout(values(layerConfigs));

  for (const layerConfigs of groups) {
    const groupLayers = layerConfigs.map(layerConfig => layers[layerConfig.id]);

    const layer = groupLayers[0];
    if (layer.visibility === 'none') {
      continue;
    }

    const { source = '', sourceLayer = '_geojsonTileLayer' } = layer;
    const sourceGroup = (familiesBySource[source] ??= {});
    const sourceLayerFamilies = (sourceGroup[sourceLayer] ??= []);
    sourceLayerFamilies.push(groupLayers);
  }
  return familiesBySource;
}

module.exports = StyleLayerIndex;
