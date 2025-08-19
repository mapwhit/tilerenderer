const FeatureIndex = require('../data/feature_index');

const { performSymbolLayout } = require('../symbol/symbol_layout');
const { CollisionBoxArray } = require('../data/array_types');
const dictionaryCoder = require('../util/dictionary_coder');
const SymbolBucket = require('../data/bucket/symbol_bucket');
const LineBucket = require('../data/bucket/line_bucket');
const FillBucket = require('../data/bucket/fill_bucket');
const FillExtrusionBucket = require('../data/bucket/fill_extrusion_bucket');
const { mapObject } = require('../util/object');
const warn = require('../util/warn');
const assert = require('assert');
const ImageAtlas = require('../render/image_atlas');
const GlyphAtlas = require('../render/glyph_atlas');
const EvaluationParameters = require('../style/evaluation_parameters');
const { OverscaledTileID } = require('./tile_id');

module.exports = makeWorkerTile;

async function makeWorkerTile(params, vectorTile, layerIndex, resources) {
  const tileID = createTileID(params);

  const overscaling = tileID.overscaleFactor();
  const { uid, zoom, pixelRatio, source, showCollisionBoxes, globalState, justReloaded, painter } = params;

  const collisionBoxArray = new CollisionBoxArray();
  const sourceLayerCoder = dictionaryCoder(Object.keys(vectorTile.layers));

  const featureIndex = new FeatureIndex(tileID);
  featureIndex.bucketLayerIDs = [];

  const uniqueBuckets = new Map();

  const options = {
    featureIndex,
    iconDependencies: {},
    patternDependencies: {},
    glyphDependencies: {}
  };

  const layerFamilies = layerIndex.familiesBySource.get(source) ?? new Map();
  for (const [sourceLayerId, sourceLayerFamilies] of layerFamilies) {
    const sourceLayer = vectorTile.layers[sourceLayerId];
    if (!sourceLayer) {
      continue;
    }

    const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
    const features = new Array(sourceLayer.length);
    for (let index = 0; index < sourceLayer.length; index++) {
      features[index] = { feature: sourceLayer.feature(index), index, sourceLayerIndex };
    }

    for (const layers of sourceLayerFamilies.values()) {
      const layer = layers[0];

      if (layer.minzoom && zoom < Math.floor(layer.minzoom)) continue;
      if (layer.maxzoom && zoom >= layer.maxzoom) continue;
      if (layer.visibility === 'none') continue;

      recalculateLayers(layers, zoom, globalState);

      const bucket = layer.createBucket({
        index: featureIndex.bucketLayerIDs.length,
        layers,
        zoom,
        pixelRatio,
        overscaling,
        collisionBoxArray,
        sourceLayerIndex,
        sourceID: source,
        globalState
      });
      uniqueBuckets.set(layer.id, bucket);
      bucket.populate(features, options);
      featureIndex.bucketLayerIDs.push(layers.map(l => l.id));
    }
  }

  const buckets = new Map();
  const { glyphAtlas, imageAtlas, glyphMap, iconMap } = await makeAtlasses(options, resources);
  let hasSymbolBuckets = false;
  let queryPadding = 0;
  for (const bucket of uniqueBuckets.values()) {
    if (bucket instanceof SymbolBucket) {
      hasSymbolBuckets = true;
      recalculateLayers(bucket.layers, zoom, globalState);
      performSymbolLayout(
        bucket,
        glyphMap,
        glyphAtlas.positions,
        iconMap,
        imageAtlas.iconPositions,
        showCollisionBoxes
      );
      if (justReloaded) {
        bucket.justReloaded = true;
      }
    } else if (
      bucket.hasPattern &&
      (bucket instanceof LineBucket || bucket instanceof FillBucket || bucket instanceof FillExtrusionBucket)
    ) {
      recalculateLayers(bucket.layers, zoom, globalState);
      bucket.addFeatures(options, imageAtlas.patternPositions);
    }
    if (bucket.isEmpty()) {
      continue; // Skip empty buckets
    }
    bucket.stateDependentLayers = [];
    for (const layer of bucket.layers) {
      if (painter?.style) {
        queryPadding = Math.max(queryPadding, painter.style.getLayer(layer.id).queryRadius(bucket));
      }
      if (layer.isStateDependent()) {
        bucket.stateDependentLayers.push(layer);
      }
      buckets.set(layer.id, bucket);
    }
  }

  return {
    buckets,
    featureIndex,
    collisionBoxArray,
    glyphAtlasImage: glyphAtlas.image,
    imageAtlas,
    hasSymbolBuckets,
    queryPadding
  };
}

async function makeAtlasses({ glyphDependencies, patternDependencies, iconDependencies }, resources) {
  const stacks = mapObject(glyphDependencies, glyphs => Object.keys(glyphs).map(Number));
  const icons = Object.keys(iconDependencies);
  const patterns = Object.keys(patternDependencies);
  const tasks = [
    Object.keys(stacks).length ? resources.getGlyphs({ stacks }) : {},
    icons.length ? resources.getImages({ icons }) : {},
    patterns.length ? resources.getImages({ icons: patterns }) : {}
  ];
  const [glyphMap, iconMap, patternMap] = await Promise.all(tasks);
  const glyphAtlas = new GlyphAtlas(glyphMap);
  const imageAtlas = new ImageAtlas(iconMap, patternMap);
  return { glyphAtlas, imageAtlas, glyphMap, iconMap };
}

function createTileID({ tileID }) {
  const { overscaledZ, wrap, canonical } = tileID;
  const { x, y, z } = canonical;
  return new OverscaledTileID(overscaledZ, wrap, z, x, y);
}

function recalculateLayers(layers, zoom, globalState) {
  // Layers are shared and may have been used by a WorkerTile with a different zoom.
  const parameters = new EvaluationParameters(zoom, { globalState });
  for (const layer of layers) {
    layer.recalculate(parameters);
  }
}
