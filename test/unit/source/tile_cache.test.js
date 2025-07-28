const { test } = require('../../util/mapbox-gl-js-test');
const TileCache = require('../../../src/source/tile_cache');
const { OverscaledTileID } = require('../../../src/source/tile_id');

const idA = new OverscaledTileID(10, 0, 10, 0, 1);
const idB = new OverscaledTileID(10, 0, 10, 0, 2);
const idC = new OverscaledTileID(10, 0, 10, 0, 3);
const idD = new OverscaledTileID(10, 0, 10, 0, 4);
const tileA = { tileID: idA };
const tileA2 = { tileID: idA };
const tileB = { tileID: idB };
const tileC = { tileID: idC };
const tileD = { tileID: idD };

function keysExpected(t, cache, ids) {
  t.assert.deepEqual(
    cache.keys,
    ids.map(id => id.key),
    'keys'
  );
}

test('TileCache', t => {
  const cache = new TileCache(10, removed => {
    t.assert.equal(removed, 'dc');
  });
  t.assert.equal(cache.getAndRemove(idC), null, '.getAndRemove() to null');
  t.assert.equal(cache.add(tileA), cache, '.add()');
  keysExpected(t, cache, [idA]);
  t.assert.equal(cache.has(idA), true, '.has()');
  t.assert.equal(cache.getAndRemove(idA), tileA, '.getAndRemove()');
  t.assert.equal(cache.getAndRemove(idA), null, '.getAndRemove()');
  t.assert.equal(cache.has(idA), false, '.has()');
  keysExpected(t, cache, []);
});

test('TileCache - getWithoutRemoving', t => {
  const cache = new TileCache(10, () => {
    t.assert.fail();
  });
  t.assert.equal(cache.add(tileA), cache, '.add()');
  t.assert.equal(cache.get(idA), tileA, '.get()');
  keysExpected(t, cache, [idA]);
  t.assert.equal(cache.get(idA), tileA, '.get()');
});

test('TileCache - remove', t => {
  const cache = new TileCache(10, () => {});

  cache.add(tileA);
  cache.add(tileB);
  cache.add(tileC);

  keysExpected(t, cache, [idA, idB, idC]);
  t.assert.ok(cache.has(idB));

  cache.getAndRemove(idB);

  keysExpected(t, cache, [idA, idC]);
  t.assert.ok(!cache.has(idB));
  t.assert.ok(!cache.getAndRemove(idB));
});

test('TileCache - overflow', t => {
  const cache = new TileCache(1, removed => {
    t.assert.equal(removed, tileA);
  });
  cache.add(tileA);
  cache.add(tileB);

  t.assert.ok(cache.has(idB));
  t.assert.ok(!cache.has(idA));
});

test('TileCache#reset', t => {
  let called;
  const cache = new TileCache(10, removed => {
    t.assert.equal(removed, tileA);
    called = true;
  });
  cache.add(tileA);
  t.assert.equal(cache.reset(), cache);
  t.assert.equal(cache.has(idA), false);
  t.assert.ok(called);
});

test('TileCache#setMaxSize', t => {
  let numRemoved = 0;
  const cache = new TileCache(10, () => {
    numRemoved++;
  });
  cache.add(tileA);
  cache.add(tileB);
  cache.add(tileC);
  t.assert.equal(numRemoved, 0);
  cache.setMaxSize(15);
  t.assert.equal(numRemoved, 0);
  cache.setMaxSize(1);
  t.assert.equal(numRemoved, 2);
  cache.add(tileD);
  t.assert.equal(numRemoved, 3);
});
