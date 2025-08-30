import { CollisionBoxArray } from '../data/array_types.js';
import FillBucket from '../data/bucket/fill_bucket.js';
import FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket.js';
import LineBucket from '../data/bucket/line_bucket.js';
import SymbolBucket from '../data/bucket/symbol_bucket.js';
import FeatureIndex from '../data/feature_index.js';
import GlyphAtlas from '../render/glyph_atlas.js';
import ImageAtlas from '../render/image_atlas.js';
import EvaluationParameters from '../style/evaluation_parameters.js';
import { performSymbolLayout } from '../symbol/symbol_layout.js';
import dictionaryCoder from '../util/dictionary_coder.js';
import { mapObject } from '../util/object.js';
import { OverscaledTileID } from './tile_id.js';
export default makeWorkerTile;

async function makeWorkerTile(params, { layers }, layerIndex, resources) {
  const options = initializeBucketsOptions(params);

  const { source } = params;
  const sourceLayerCoder = dictionaryCoder(Object.keys(layers));
  const layerFamilies = layerIndex.familiesBySource.get(source) ?? new Map();
  for (const [sourceLayerId, sourceLayerFamilies] of layerFamilies) {
    const sourceLayer = layers[sourceLayerId];
    if (!sourceLayer) {
      continue;
    }
    const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
    const features = new Array(sourceLayer.length);
    for (let index = 0; index < sourceLayer.length; index++) {
      features[index] = { feature: sourceLayer.feature(index), index, sourceLayerIndex };
    }

    makeBucketsForSourceLayer(sourceLayerFamilies, sourceLayerIndex, features, params, options);
  }

  return await finalizeBuckets(params, options, resources);
}

export async function makeSingleSourceLayerWorkerTile(params, features, sourceLayerFamilies, resources) {
  const options = initializeBucketsOptions(params);

  makeBucketsForSourceLayer(sourceLayerFamilies, 0, features, params, options);

  return await finalizeBuckets(params, options, resources);
}

function initializeBucketsOptions(params) {
  const tileID = createTileID(params);

  const featureIndex = new FeatureIndex(tileID);
  featureIndex.bucketLayerIDs = [];

  return {
    collisionBoxArray: new CollisionBoxArray(),
    featureIndex,
    glyphDependencies: {},
    iconDependencies: {},
    overscaling: tileID.overscaleFactor(),
    patternDependencies: {},
    uniqueBuckets: new Map()
  };
}

function makeBucketsForSourceLayer(sourceLayerFamilies, sourceLayerIndex, features, params, options) {
  const { zoom, pixelRatio, source } = params;
  const { featureIndex, overscaling, collisionBoxArray, uniqueBuckets } = options;

  for (const layers of sourceLayerFamilies.values()) {
    const layer = layers[0];

    if (layer.isHidden(zoom, layer.minzoom && Math.floor(layer.minzoom))) {
      continue;
    }

    recalculateLayers(layers, zoom);

    const bucket = layer.createBucket({
      index: featureIndex.bucketLayerIDs.length,
      layers,
      zoom,
      pixelRatio,
      overscaling,
      collisionBoxArray,
      sourceLayerIndex,
      sourceID: source
    });
    uniqueBuckets.set(layer.id, bucket);
    bucket.populate(features, options);
    featureIndex.bucketLayerIDs.push(layers.map(l => l.id));
  }
}

async function finalizeBuckets(params, options, resources) {
  const { zoom, showCollisionBoxes, justReloaded, painter } = params;
  const { collisionBoxArray, featureIndex, uniqueBuckets } = options;
  const buckets = new Map();
  const { glyphAtlas, imageAtlas, glyphMap, iconMap } = await makeAtlasses(options, resources);
  let hasSymbolBuckets = false;
  let queryPadding = 0;
  for (const bucket of uniqueBuckets.values()) {
    if (bucket instanceof SymbolBucket) {
      hasSymbolBuckets = true;
      recalculateLayers(bucket.layers, zoom);
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
      recalculateLayers(bucket.layers, zoom);
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

function recalculateLayers(layers, zoom) {
  // Layers are shared and may have been used by a WorkerTile with a different zoom.
  const parameters = new EvaluationParameters(zoom);
  for (const layer of layers) {
    layer.recalculate(parameters);
  }
}
