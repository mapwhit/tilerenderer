const test = require('node:test');
const GlyphManager = require('../../../src/render/glyph_manager');

test('GlyphManager', async t => {
  let glyphManager;
  let mockLoader;

  t.beforeEach(t => {
    mockLoader = t.mock.fn();
    glyphManager = new GlyphManager();
    glyphManager.setGlyphsLoader(mockLoader);
  });

  await t.test('should load glyph range', async () => {
    const stack = 'Arial';
    const range = 0;
    const expectedResponse = [1, 2, 3];

    mockLoader.mock.mockImplementation(() => Promise.resolve(expectedResponse));

    const response = await glyphManager.loadGlyphRange(stack, range);

    t.assert.deepStrictEqual(response, expectedResponse);
    t.assert.strictEqual(mockLoader.mock.callCount(), 1);
    t.assert.strictEqual(mockLoader.mock.calls[0].arguments[0], stack);
    t.assert.strictEqual(mockLoader.mock.calls[0].arguments[1], range);
  });

  await t.test('should cache loaded glyph ranges', async () => {
    const stack = 'Arial';
    const range = 0;
    const expectedResponse = [1, 2, 3];

    mockLoader.mock.mockImplementation(() => Promise.resolve(expectedResponse));

    const response1 = await glyphManager.loadGlyphRange(stack, range);
    const response2 = await glyphManager.loadGlyphRange(stack, range);

    t.assert.deepStrictEqual(response1, expectedResponse);
    t.assert.deepStrictEqual(response2, expectedResponse);
    t.assert.strictEqual(mockLoader.mock.callCount(), 1);
  });
});
