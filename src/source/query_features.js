const { mat4 } = require('@mapbox/gl-matrix');

module.exports = {
  queryRenderedFeatures,
  queryRenderedSymbols,
  querySourceFeatures
};

/*
 * Returns a matrix that can be used to convert from tile coordinates to viewport pixel coordinates.
 */
function getPixelPosMatrix(transform, tileID) {
  const t = mat4.identity([]);
  mat4.translate(t, t, [1, 1, 0]);
  mat4.scale(t, t, [transform.width * 0.5, transform.height * 0.5, 1]);
  return mat4.multiply(t, t, transform.calculatePosMatrix(tileID.toUnwrapped()));
}

function queryIncludes3DLayer(layers, styleLayers, sourceID) {
  const layersToCheck = layers ?? styleLayers;
  if (!layersToCheck) return false;
  return Object.values(layersToCheck).some(layer => layer?.source === sourceID && layer.type === 'fill-extrusion');
}

function queryRenderedFeatures(sourceCache, styleLayers, queryGeometry, params, transform) {
  const has3DLayer = queryIncludes3DLayer(params?.layers, styleLayers, sourceCache.id);
  const maxPitchScaleFactor = transform.maxPitchScaleFactor();
  const renderedFeatureLayers = sourceCache
    .tilesIn(queryGeometry, maxPitchScaleFactor, has3DLayer)
    .sort(sortTilesIn)
    .map(tile => ({
      wrappedTileID: tile.tileID.wrapped().key,
      queryResults: tile.tile.queryRenderedFeatures(
        styleLayers,
        sourceCache._state,
        tile.queryGeometry,
        tile.cameraQueryGeometry,
        tile.scale,
        params,
        transform,
        maxPitchScaleFactor,
        getPixelPosMatrix(sourceCache.transform, tile.tileID)
      )
    }));

  const result = mergeRenderedFeatureLayers(renderedFeatureLayers);

  // Merge state from SourceCache into the results
  for (const [layerID, layerResult] of Object.entries(result)) {
    layerResult.forEach(({ feature }) => {
      const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
      feature.source = feature.layer.source;
      if (feature.layer['source-layer']) {
        feature.sourceLayer = feature.layer['source-layer'];
      }
      feature.state = state;
    });
  }
  return result;
}

function queryRenderedSymbols(styleLayers, sourceCaches, queryGeometry, params, collisionIndex, retainedQueryData) {
  const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
  const bucketQueryData = Object.keys(renderedSymbols)
    .map(id => retainedQueryData[+id])
    .sort(sortTilesIn);

  const result = {};
  for (const queryData of bucketQueryData) {
    const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(
      renderedSymbols[queryData.bucketInstanceId],
      queryData.bucketIndex,
      queryData.sourceLayerIndex,
      params.filter,
      params.layers,
      styleLayers
    );

    const { featureSortOrder } = queryData;
    const sortFeatures = featureSortOrder ? getSorter(featureSortOrder) : simpleSortFeatures;
    for (const [layerID, layerSymbols] of Object.entries(bucketSymbols)) {
      layerSymbols.sort(sortFeatures);
      const resultFeatures = result[layerID];
      if (resultFeatures) {
        resultFeatures.push(...layerSymbols);
      } else {
        result[layerID] = [...layerSymbols];
      }
    }
  }

  // Merge state from SourceCache into the results
  for (const [layerName, layerResult] of Object.entries(result)) {
    layerResult.forEach(({ feature }) => {
      const { source } = styleLayers[layerName];
      const sourceCache = sourceCaches[source];
      const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
      feature.source = feature.layer.source;
      if (feature.layer['source-layer']) {
        feature.sourceLayer = feature.layer['source-layer'];
      }
      feature.state = state;
    });
  }
  return result;
}

// The bucket hasn't been re-sorted based on angle, so use the
// reverse of the order the features appeared in the data.
function simpleSortFeatures(a, b) {
  return b.featureIndex - a.featureIndex;
}

function getSorter(featureSortOrder) {
  // Match topDownFeatureComparator from FeatureIndex, but using
  // most recent sorting of features from bucket.sortFeatures
  // queryRenderedSymbols documentation says we'll return features in
  // "top-to-bottom" rendering order (aka last-to-first).
  return function sortFeatures(a, b) {
    const bIndex = b.featureIndex;
    const aIndex = a.featureIndex;
    if (bIndex === aIndex) return 0;
    // Actually there can be multiple symbol instances per feature, so
    // we sort each feature based on the first matching symbol instance.
    for (const index of featureSortOrder) {
      if (aIndex === index) return -1;
      if (bIndex === index) return 1;
    }
    return 0;
  };
}

function querySourceFeatures(sourceCache, params) {
  const dataTiles = new Set();
  const result = [];
  for (const tile of sourceCache.getRenderableTiles()) {
    const { key } = tile.tileID.canonical;
    if (!dataTiles.has(key)) {
      dataTiles.add(key);
      tile.querySourceFeatures(result, params);
    }
  }
  return result;
}

function sortTilesIn(a, b) {
  const idA = a.tileID;
  const idB = b.tileID;
  return (
    idA.overscaledZ - idB.overscaledZ ||
    idA.canonical.y - idB.canonical.y ||
    idA.wrap - idB.wrap ||
    idA.canonical.x - idB.canonical.x
  );
}

function mergeRenderedFeatureLayers(tiles) {
  // Merge results from all tiles, but if two tiles share the same
  // wrapped ID, don't duplicate features between the two tiles
  const result = {};
  const wrappedIDLayerMap = {};
  for (const tile of tiles) {
    const { queryResults, wrappedTileID } = tile;
    const wrappedIDLayers = (wrappedIDLayerMap[wrappedTileID] ??= {});
    for (const [layerID, tileFeatures] of Object.entries(queryResults)) {
      const wrappedIDFeatures = (wrappedIDLayers[layerID] ??= {});
      const resultFeatures = (result[layerID] ??= []);
      for (const tileFeature of tileFeatures) {
        if (!wrappedIDFeatures[tileFeature.featureIndex]) {
          wrappedIDFeatures[tileFeature.featureIndex] = true;
          resultFeatures.push(tileFeature);
        }
      }
    }
  }
  return result;
}
