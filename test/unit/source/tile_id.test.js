const test = require('node:test');
const { CanonicalTileID, OverscaledTileID } = require('../../../src/source/tile_id');

test('CanonicalTileID', async t => {
  await t.test('constructor', t => {
    t.assert.throws(() => {
      new CanonicalTileID(-1, 0, 0);
    });
    t.assert.throws(() => {
      new CanonicalTileID(26, 0, 0);
    });
    t.assert.throws(() => {
      new CanonicalTileID(2, 4, 0);
    });
    t.assert.throws(() => {
      new CanonicalTileID(2, 0, 4);
    });
  });

  await t.test('.key', t => {
    t.assert.deepEqual(new CanonicalTileID(0, 0, 0).key, 0);
    t.assert.deepEqual(new CanonicalTileID(1, 0, 0).key, 1);
    t.assert.deepEqual(new CanonicalTileID(1, 1, 0).key, 33);
    t.assert.deepEqual(new CanonicalTileID(1, 1, 1).key, 97);
  });

  await t.test('.equals', t => {
    t.assert.ok(new CanonicalTileID(3, 2, 1).equals(new CanonicalTileID(3, 2, 1)));
    t.assert.ok(!new CanonicalTileID(9, 2, 3).equals(new CanonicalTileID(3, 2, 1)));
  });
});

test('OverscaledTileID', async t => {
  await t.test('constructor', t => {
    t.assert.ok(new OverscaledTileID(0, 0, 0, 0, 0) instanceof OverscaledTileID);
    t.assert.throws(() => {
      new OverscaledTileID(7, 0, 8, 0, 0);
    });
  });

  await t.test('.key', t => {
    t.assert.deepEqual(new OverscaledTileID(0, 0, 0, 0, 0).key, 0);
    t.assert.deepEqual(new OverscaledTileID(1, 0, 1, 0, 0).key, 1);
    t.assert.deepEqual(new OverscaledTileID(1, 0, 1, 1, 0).key, 33);
    t.assert.deepEqual(new OverscaledTileID(1, 0, 1, 1, 1).key, 97);
    t.assert.deepEqual(new OverscaledTileID(1, -1, 1, 1, 1).key, 225);
  });

  await t.test('.toString', async t => {
    await t.test('calculates strings', t => {
      t.assert.deepEqual(new OverscaledTileID(1, 0, 1, 1, 1).toString(), '1/1/1');
    });
  });

  await t.test('.children', t => {
    t.assert.deepEqual(new OverscaledTileID(0, 0, 0, 0, 0).children(25), [
      new OverscaledTileID(1, 0, 1, 0, 0),
      new OverscaledTileID(1, 0, 1, 1, 0),
      new OverscaledTileID(1, 0, 1, 0, 1),
      new OverscaledTileID(1, 0, 1, 1, 1)
    ]);
    t.assert.deepEqual(new OverscaledTileID(0, 0, 0, 0, 0).children(0), [new OverscaledTileID(1, 0, 0, 0, 0)]);
  });

  await t.test('.scaledTo', async t => {
    await t.test('returns a parent', t => {
      t.assert.deepEqual(new OverscaledTileID(2, 0, 2, 0, 0).scaledTo(0), new OverscaledTileID(0, 0, 0, 0, 0));
      t.assert.deepEqual(new OverscaledTileID(1, 0, 1, 0, 0).scaledTo(0), new OverscaledTileID(0, 0, 0, 0, 0));
      t.assert.deepEqual(new OverscaledTileID(1, 0, 0, 0, 0).scaledTo(0), new OverscaledTileID(0, 0, 0, 0, 0));
    });
  });
});
