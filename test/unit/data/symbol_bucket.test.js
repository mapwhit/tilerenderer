import test from 'node:test';
import { CollisionBoxArray } from '../../../src/data/array_types.js';
import SymbolBucket from '../../../src/data/bucket/symbol_bucket.js';
import FeatureIndex from '../../../src/data/feature_index.js';
import Transform from '../../../src/geo/transform.js';
import Tile from '../../../src/source/tile.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import CrossTileSymbolIndex from '../../../src/symbol/cross_tile_symbol_index.js';
import { Placement } from '../../../src/symbol/placement.js';
import { performSymbolLayout } from '../../../src/symbol/symbol_layout.js';
import glyphs from '../../fixtures/fontstack-glyphs.json' with { type: 'json' };
import { createSymbolBucket } from '../../util/create_symbol_layer.js';
import { createPopulateOptions, loadVectorTile } from '../../util/tile.js';

const collisionBoxArray = new CollisionBoxArray();
const transform = new Transform();
transform.width = 100;
transform.height = 100;
transform.cameraToCenterDistance = 100;

const stacks = { Test: glyphs };

test('SymbolBucket', async t => {
  let features;
  t.before(() => {
    // Load point features from fixture tile.
    const sourceLayer = loadVectorTile().layers.place_label;
    features = [{ feature: sourceLayer.feature(10) }];
  });

  await t.test('SymbolBucket', t => {
    const bucketA = createSymbolBucket(collisionBoxArray);
    const bucketB = createSymbolBucket(collisionBoxArray);
    const options = createPopulateOptions();
    const placement = new Placement(transform, 0, true);
    const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
    const crossTileSymbolIndex = new CrossTileSymbolIndex();

    // add feature from bucket A
    bucketA.populate(features, options);
    performSymbolLayout(bucketA, stacks, {});
    const tileA = new Tile(tileID, 512);
    tileA.latestFeatureIndex = new FeatureIndex(tileID);
    tileA.buckets = new Map([['test', bucketA]]);
    tileA.collisionBoxArray = collisionBoxArray;

    // add same feature from bucket B
    bucketB.populate(features, options);
    performSymbolLayout(bucketB, stacks, {});
    const tileB = new Tile(tileID, 512);
    tileB.buckets = new Map([['test', bucketB]]);
    tileB.collisionBoxArray = collisionBoxArray;

    crossTileSymbolIndex.addLayer(bucketA.layers[0], [tileA, tileB]);

    const place = (layer, tile) => {
      const parts = [];
      placement.getBucketParts(parts, layer, tile, false);
      for (const part of parts) {
        placement.placeLayerBucketPart(part, {}, false);
      }
    };
    const a = placement.collisionIndex.grid.keysLength();
    place(bucketA.layers[0], tileA);
    const b = placement.collisionIndex.grid.keysLength();
    t.assert.notEqual(a, b, 'places feature');

    const a2 = placement.collisionIndex.grid.keysLength();
    place(bucketB.layers[0], tileB);
    const b2 = placement.collisionIndex.grid.keysLength();
    t.assert.equal(b2, a2, 'detects collision and does not place feature');
  });

  await t.test('SymbolBucket integer overflow', t => {
    let _MAX_GLYPHS;
    t.before(() => {
      _MAX_GLYPHS = SymbolBucket.MAX_GLYPHS;
      SymbolBucket.MAX_GLYPHS = 5;
    });
    t.after(() => {
      SymbolBucket.MAX_GLYPHS = _MAX_GLYPHS;
    });
    const warn = t.mock.method(console, 'warn');

    const bucket = createSymbolBucket(collisionBoxArray);

    bucket.populate(features, createPopulateOptions());
    const fakeGlyph = { rect: { w: 10, h: 10 }, metrics: { left: 10, top: 10, advance: 10 } };
    performSymbolLayout(bucket, stacks, {
      Test: { 97: fakeGlyph, 98: fakeGlyph, 99: fakeGlyph, 100: fakeGlyph, 101: fakeGlyph, 102: fakeGlyph }
    });

    t.assert.equal(warn.mock.callCount(), 1);
    t.assert.match(warn.mock.calls[0].arguments[0], /Too many glyphs being rendered in a tile./);
  });

  await t.test('SymbolBucket detects rtl text', t => {
    const rtlBucket = createSymbolBucket(collisionBoxArray, 'مرحبا');
    const ltrBucket = createSymbolBucket(collisionBoxArray, 'hello');
    const options = { iconDependencies: {}, glyphDependencies: {} };
    rtlBucket.populate(features, options);
    ltrBucket.populate(features, options);

    t.assert.ok(rtlBucket.hasRTLText);
    t.assert.ok(!ltrBucket.hasRTLText);
  });

  // Test to prevent symbol bucket with rtl from text being culled by worker serialization.
  await t.test('SymbolBucket with rtl text is NOT empty even though no symbol instances are created', t => {
    const rtlBucket = createSymbolBucket(collisionBoxArray, 'مرحبا');
    const options = { iconDependencies: {}, glyphDependencies: {} };
    rtlBucket.createArrays();
    rtlBucket.populate(features, options);

    t.assert.ok(!rtlBucket.isEmpty());
    t.assert.equal(rtlBucket.symbolInstances.length, 0);
  });

  await t.test('SymbolBucket detects rtl text mixed with ltr text', t => {
    const mixedBucket = createSymbolBucket(collisionBoxArray, 'مرحبا translates to hello');
    const options = { iconDependencies: {}, glyphDependencies: {} };
    mixedBucket.populate(features, options);

    t.assert.ok(mixedBucket.hasRTLText);
  });
});
