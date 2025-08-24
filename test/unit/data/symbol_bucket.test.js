import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Protobuf from '@mapwhit/pbf';
import { VectorTile } from '@mapwhit/vector-tile';
import { CollisionBoxArray } from '../../../src/data/array_types.js';
import SymbolBucket from '../../../src/data/bucket/symbol_bucket.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import Transform from '../../../src/geo/transform.js';
import Tile from '../../../src/source/tile.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer.js';
import featureFilter from '../../../src/style-spec/feature_filter/index.js';
import CrossTileSymbolIndex from '../../../src/symbol/cross_tile_symbol_index.js';
import { Placement } from '../../../src/symbol/placement.js';
import { performSymbolLayout } from '../../../src/symbol/symbol_layout.js';

// Load a point feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(import.meta.dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
);
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '/../../fixtures/fontstack-glyphs.json')));

const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = { Test: glyphs };

function bucketSetup() {
  const layer = new SymbolStyleLayer({
    id: 'test',
    type: 'symbol',
    layout: { 'text-font': ['Test'], 'text-field': 'abcde' },
    filter: featureFilter()
  });
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  return new SymbolBucket({
    overscaling: 1,
    zoom: 0,
    collisionBoxArray: collisionBoxArray,
    layers: [layer]
  });
}

test('SymbolBucket', t => {
  const bucketA = bucketSetup();
  const bucketB = bucketSetup();
  const options = { iconDependencies: {}, glyphDependencies: {} };
  const placement = new Placement(transform, 0, true);
  const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
  const crossTileSymbolIndex = new CrossTileSymbolIndex();

  // add feature from bucket A
  bucketA.populate([{ feature }], options);
  performSymbolLayout(bucketA, stacks, {});
  const tileA = new Tile(tileID, 512);
  tileA.latestFeatureIndex = new FeatureIndex(tileID);
  tileA.buckets = new Map([['test', bucketA]]);
  tileA.collisionBoxArray = collisionBoxArray;

  // add same feature from bucket B
  bucketB.populate([{ feature }], options);
  performSymbolLayout(bucketB, stacks, {});
  const tileB = new Tile(tileID, 512);
  tileB.buckets = new Map([['test', bucketB]]);
  tileB.collisionBoxArray = collisionBoxArray;

  crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB]);

  const a = placement.collisionIndex.grid.keysLength();
  placement.placeLayerTile(bucketA.layers[0], tileA, false, {});
  const b = placement.collisionIndex.grid.keysLength();
  t.assert.notEqual(a, b, 'places feature');

  const a2 = placement.collisionIndex.grid.keysLength();
  placement.placeLayerTile(bucketB.layers[0], tileB, false, {});
  const b2 = placement.collisionIndex.grid.keysLength();
  t.assert.equal(b2, a2, 'detects collision and does not place feature');
});

test('SymbolBucket integer overflow', t => {
  let _MAX_GLYPHS;
  t.before(() => {
    _MAX_GLYPHS = SymbolBucket.MAX_GLYPHS;
    SymbolBucket.MAX_GLYPHS = 5;
  });
  t.after(() => {
    SymbolBucket.MAX_GLYPHS = _MAX_GLYPHS;
  });
  const warn = t.mock.method(console, 'warn');

  const bucket = bucketSetup();
  const options = { iconDependencies: {}, glyphDependencies: {} };

  bucket.populate([{ feature }], options);
  const fakeGlyph = { rect: { w: 10, h: 10 }, metrics: { left: 10, top: 10, advance: 10 } };
  performSymbolLayout(bucket, stacks, {
    Test: { 97: fakeGlyph, 98: fakeGlyph, 99: fakeGlyph, 100: fakeGlyph, 101: fakeGlyph, 102: fakeGlyph }
  });

  t.assert.equal(warn.mock.callCount(), 1);
  t.assert.match(warn.mock.calls[0].arguments[0], /Too many glyphs being rendered in a tile./);
});
