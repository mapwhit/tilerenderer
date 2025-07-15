const { pick } = require('../util/object');

module.exports = fromTileJSON;

function fromTileJSON(tileJSON) {
  const result = pick(tileJSON, ['tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds']);
  if (tileJSON.vector_layers) {
    result.vectorLayers = tileJSON.vector_layers;
    result.vectorLayerIds = result.vectorLayers.map(layer => layer.id);
  }
  return result;
}
