const { test } = require('../../util/mapbox-gl-js-test');
const fs = require('fs');
const path = require('path');
const Protobuf = require('@mapwhit/pbf');
const { VectorTile } = require('@mapwhit/vector-tile');
const SymbolBucket = require('../../../src/data/bucket/symbol_bucket');
const { CollisionBoxArray } = require('../../../src/data/array_types');
const SymbolStyleLayer = require('../../../src/style/style_layer/symbol_style_layer');
const featureFilter = require('../../../src/style-spec/feature_filter');
const { performSymbolLayout } = require('../../../src/symbol/symbol_layout');
const { Placement } = require('../../../src/symbol/placement');
const Transform = require('../../../src/geo/transform');
const { OverscaledTileID } = require('../../../src/source/tile_id');
const Tile = require('../../../src/source/tile');
const CrossTileSymbolIndex = require('../../../src/symbol/cross_tile_symbol_index');
const FeatureIndex = require('../../../src/data/feature_index');

// Load a point feature from fixture tile.
const vt = new VectorTile(
  new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))
);
const feature = vt.layers.place_label.feature(10);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')));

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
  tileA.buckets = { test: bucketA };
  tileA.collisionBoxArray = collisionBoxArray;

  // add same feature from bucket B
  bucketB.populate([{ feature }], options);
  performSymbolLayout(bucketB, stacks, {});
  const tileB = new Tile(tileID, 512);
  tileB.buckets = { test: bucketB };
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
