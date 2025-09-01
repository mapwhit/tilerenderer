export default function (tileJSON) {
  return tileJSON.resourceSets ? fromResourseSets(tileJSON) : fromTileJSON(tileJSON);
}

function fromTileJSON({ tiles, minzoom, maxzoom, attribution, bounds, vector_layers }) {
  const result = {
    tiles
  };
  if (typeof minzoom === 'number') {
    result.minzoom = minzoom;
  }
  if (typeof maxzoom === 'number') {
    result.maxzoom = maxzoom;
  }
  if (bounds) {
    result.bounds = bounds;
  }
  if (attribution) {
    result.attribution = attribution;
  }
  if (vector_layers) {
    result.vectorLayers = vector_layers;
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
