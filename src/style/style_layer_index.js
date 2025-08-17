const groupByLayout = require('../style-spec/group_by_layout');

class StyleLayerIndex {
  #layers = new Map();
  #fbs = {};

  constructor(layers) {
    if (layers) {
      this.replace(layers);
    }
  }

  replace(layers) {
    this.#layers = layers;
    this.#fbs = null;
  }

  update() {
    this.#fbs = null;
  }

  get familiesBySource() {
    if (!this.#fbs) {
      this.#fbs = calculateFamiliesBySource(this.#layers);
    }
    return this.#fbs;
  }
}

function calculateFamiliesBySource(layers) {
  const familiesBySource = {};
  const groups = groupByLayout(layers.values());

  for (const groupLayers of groups) {
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
