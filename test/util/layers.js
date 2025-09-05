import createStyleLayer from '../../src/style/create_style_layer.js';

export function create(layerConfigs, { globalState } = {}) {
  if (layerConfigs) {
    const layers = new Map();
    for (const layerConfig of layerConfigs) {
      const layer = createStyleLayer(layerConfig, globalState);
      layers.set(layerConfig.id, layer);
    }
    return layers;
  }
}
