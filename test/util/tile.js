import fs from 'node:fs';
import path from 'node:path';
import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import FeatureIndex from '../../src/data/feature_index.js';
import { OverscaledTileID } from '../../src/source/tile_id.js';

export function loadVectorTile(name = 'mbsv5-6-18-23.vector.pbf') {
  const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(import.meta.dirname, '/../fixtures/', name))));
  return vt;
}

export function getFeaturesFromLayer(sourceLayer) {
  const features = new Array(sourceLayer.length);
  for (let i = 0; i < sourceLayer.length; i++) {
    features[i] = { feature: sourceLayer.feature(i), index: i };
  }
  return features;
}

export function createPopulateOptions() {
  return {
    featureIndex: new FeatureIndex(new OverscaledTileID(0, 0, 0, 0, 0)),
    iconDependencies: {},
    patternDependencies: {},
    glyphDependencies: {}
  };
}
