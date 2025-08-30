export default groupBySource;

/**
 * Given an collection of layers, divide them by property 'source', then by 'source-layer',
 * and then by layout-affecting properties: 'type', , 'minzoom', 'maxzoom', 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @param layers iterable collection of layers
 * @returns Map source to {Map source-layer to {Map layout key to Array of layers}}
 */
function groupBySource(layers) {
  const groups = new Map();

  // Iterate through each layer and group them by source, source-layer, and layout properties
  for (const layer of layers) {
    if (layer.isHidden()) {
      continue;
    }

    const { source = '', sourceLayer = '_geojsonTileLayer' } = layer;
    let sourceGroup = groups.get(source);
    if (!sourceGroup) {
      sourceGroup = new Map();
      groups.set(source, sourceGroup);
    }
    let sourceLayerGroup = sourceGroup.get(sourceLayer);
    if (!sourceLayerGroup) {
      sourceLayerGroup = new Map();
      sourceGroup.set(sourceLayer, sourceLayerGroup);
    }
    let layoutGroup = sourceLayerGroup.get(layer.key);
    if (!layoutGroup) {
      layoutGroup = [];
      sourceLayerGroup.set(layer.key, layoutGroup);
    }
    layoutGroup.push(layer);
  }
  return groups;
}
