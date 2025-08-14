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
  const { uid, zoom, pixelRatio, source, showCollisionBoxes, globalState } = params;

  const collisionBoxArray = new CollisionBoxArray();
  const sourceLayerCoder = dictionaryCoder(Object.keys(vectorTile.layers));

  const featureIndex = new FeatureIndex(tileID);
  featureIndex.bucketLayerIDs = [];

  const buckets = new Map();

  const options = {
    featureIndex,
    iconDependencies: {},
    patternDependencies: {},
    glyphDependencies: {}
  };

  const layerFamilies = layerIndex.familiesBySource[source] ?? {};
  for (const [sourceLayerId, sourceLayerFamilies] of Object.entries(layerFamilies)) {
    const sourceLayer = vectorTile.layers[sourceLayerId];
    if (!sourceLayer) {
      continue;
    }

    const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
    const features = new Array(sourceLayer.length);
    for (let index = 0; index < sourceLayer.length; index++) {
      features[index] = { feature: sourceLayer.feature(index), index, sourceLayerIndex };
    }

    for (const family of sourceLayerFamilies) {
      const layer = family[0];

      if (layer.minzoom && zoom < Math.floor(layer.minzoom)) continue;
      if (layer.maxzoom && zoom >= layer.maxzoom) continue;
      if (layer.visibility === 'none') continue;

      recalculateLayers(family, zoom, globalState);

      const bucket = layer.createBucket({
        index: featureIndex.bucketLayerIDs.length,
        layers: family,
        zoom,
        pixelRatio,
        overscaling,
        collisionBoxArray,
        sourceLayerIndex,
        sourceID: source,
        globalState
      });
      buckets.set(layer.id, bucket);
      bucket.populate(features, options);
      featureIndex.bucketLayerIDs.push(family.map(l => l.id));
    }
  }

  const { glyphAtlas, imageAtlas, glyphMap, iconMap } = await makeAtlasses(uid, options, resources);
  for (const [key, bucket] of buckets) {
    if (bucket instanceof SymbolBucket) {
      recalculateLayers(bucket.layers, zoom, globalState);
      performSymbolLayout(
        bucket,
        glyphMap,
        glyphAtlas.positions,
        iconMap,
        imageAtlas.iconPositions,
        showCollisionBoxes
      );
    } else if (
      bucket.hasPattern &&
      (bucket instanceof LineBucket || bucket instanceof FillBucket || bucket instanceof FillExtrusionBucket)
    ) {
      recalculateLayers(bucket.layers, zoom, globalState);
      bucket.addFeatures(options, imageAtlas.patternPositions);
    }
  }

  buckets.forEach((bucket, id, map) => {
    if (bucket.isEmpty()) {
      map.delete(id);
    }
  });
  return {
    buckets,
    featureIndex,
    collisionBoxArray,
    glyphAtlasImage: glyphAtlas.image,
    imageAtlas
  };
}

async function makeAtlasses(uid, options, resources) {
  const { glyphDependencies, patternDependencies, iconDependencies } = options;
  const stacks = mapObject(glyphDependencies, glyphs => Object.keys(glyphs).map(Number));
  const icons = Object.keys(iconDependencies);
  const patterns = Object.keys(patternDependencies);
  const tasks = [
    Object.keys(stacks).length ? resources.getGlyphs({ uid, stacks }) : {},
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
