const { pick } = require('../util/object');

module.exports = function (tileJSON) {
  return tileJSON.resourceSets ? fromResourseSets(tileJSON) : fromTileJSON(tileJSON);
};

function fromTileJSON(tileJSON) {
  const result = pick(tileJSON, ['tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds']);
  if (tileJSON.vector_layers) {
    result.vectorLayers = tileJSON.vector_layers;
    result.vectorLayerIds = result.vectorLayers.map(layer => layer.id);
  }
  return result;
}

function fromResourseSets(tileJSON) {
  const { resourceSets } = tileJSON;
  if (!resourceSets.length) {
    throw new Error('expected resources');
  }
  const { resources } = resourceSets[0];
  if (!resources?.length) {
    throw new Error('expected resources');
  }
  const { imageUrl, imageUrlSubdomains } = resources[0];
  const result = {
    tiles: imageUrlSubdomains.map(sub => imageUrl.replace('{subdomain}', sub).replace('http:', 'https:')),
    ...tileJSON
  };
  // expects already loaded object, `url` property is ignored
  delete result.url;
  return result;
}
