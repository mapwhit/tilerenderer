const test = require('node:test');
const makeImages = require('../../../../src/source/resources/images');

test('glyphCache', async t => {
  let actor;
  let images;

  t.beforeEach(t => {
    actor = { send: t.mock.fn() };
    images = makeImages({ actor, mapId: 'test-map-id' });
  });

  await t.test('should retrtieve images using actor.send', async t => {
    const imageA = Buffer.from('image a');
    const imageB = Buffer.from('image b');
    actor.send.mock.mockImplementation(() =>
      Promise.resolve({
        a: imageA,
        b: imageB
      })
    );

    const result = await images.getImages({ icons: ['a', 'b'] });

    t.assert.strictEqual(actor.send.mock.callCount(), 1);
    t.assert.strictEqual(actor.send.mock.calls[0].arguments[0], 'getImages');
    t.assert.deepStrictEqual(actor.send.mock.calls[0].arguments[1], {
      icons: ['a', 'b']
    });

    t.assert.deepStrictEqual(result, {
      a: imageA,
      b: imageB
    });
  });

  await t.test('should not request additional images if they are already in the cache', async t => {
    const imageA = Buffer.from('image a');
    const imageB = Buffer.from('image b');
    actor.send.mock.mockImplementation(() =>
      Promise.resolve({
        a: imageA,
        b: imageB
      })
    );

    const result1 = await images.getImages({ icons: ['a', 'b'] });
    const result2 = await images.getImages({ icons: ['a'] });

    t.assert.strictEqual(actor.send.mock.callCount(), 1);

    t.assert.deepStrictEqual(result1, {
      a: imageA,
      b: imageB
    });

    t.assert.deepStrictEqual(result2, {
      a: imageA
    });
  });

  await t.test('should handle overlapping calls to getImages correctly', async t => {
    actor.send.mock.mockImplementation(() => Promise.resolve({}));

    const result1 = images.getImages({ icons: ['a', 'b', 'c'] });
    const result2 = images.getImages({ icons: ['b', 'c', 'd'] });

    await result1;
    await result2;

    t.assert.strictEqual(actor.send.mock.callCount(), 2);
    t.assert.deepStrictEqual(actor.send.mock.calls[0].arguments[1], {
      icons: ['a', 'b', 'c']
    });
    t.assert.deepStrictEqual(actor.send.mock.calls[1].arguments[1], {
      icons: ['d']
    });
  });

  await t.test('should handle missing images gracefully', async t => {
    actor.send.mock.mockImplementation(() => Promise.resolve({}));

    const result = await images.getImages({ icons: ['a', 'b'] });

    t.assert.deepStrictEqual(result, {});

    t.assert.strictEqual(actor.send.mock.callCount(), 1);

    await images.getImages({ icons: ['a', 'b'] });
    t.assert.strictEqual(actor.send.mock.callCount(), 1, 'should not request missing images again');
  });
});
