const createStyleLayer = require('../../src/style/create_style_layer');

module.exports = {
  create
};

function create(layerConfigs) {
  if (layerConfigs) {
    const layers = new Map();
    for (const layerConfig of layerConfigs) {
      const layer = createStyleLayer(layerConfig);
      layers.set(layerConfig.id, layer);
    }
    return layers;
  }
}
