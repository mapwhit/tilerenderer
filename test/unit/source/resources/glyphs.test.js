const test = require('node:test');
const makeGlyphs = require('../../../../src/source/resources/glyphs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { AlphaImage } = require('../../../../src/util/image');

test('glyphCache', async t => {
  let glyphs;
  let parseGlyphs;
  let loadGlyphRange;

  t.beforeEach(t => {
    loadGlyphRange = t.mock.fn();
    parseGlyphs = t.mock.fn();
    glyphs = makeGlyphs({ loadGlyphRange, mapId: 'test-map-id', parseGlyphs });
  });

  await t.test('should return empty result when no stacks are provided', async () => {
    const result = await glyphs.getGlyphs({ stacks: {} });
    t.assert.deepStrictEqual(result, {});
  });

  await t.test('should skip glyphs with IDs greater than MAX_GLYPH_ID', async () => {
    const stacks = { Arial: [65536, 70000] };
    const result = await glyphs.getGlyphs({ stacks });
    t.assert.deepStrictEqual(result, { Arial: { 65536: null, 70000: null } });
  });

  await t.test('should retrieve glyph ranges and parse them', async () => {
    const stacks = { Arial: [0, 1, 257] };
    const glyphData = Buffer.from('mocked data');
    const parsedGlyphs = [
      { id: 0, data: 'glyph0' },
      { id: 1, data: 'glyph1' }
    ];

    loadGlyphRange.mock.mockImplementation(() => Promise.resolve(glyphData));
    parseGlyphs.mock.mockImplementation(() => parsedGlyphs);

    const result = await glyphs.getGlyphs({ stacks });

    t.assert.strictEqual(loadGlyphRange.mock.callCount(), 2);
    t.assert.deepStrictEqual(loadGlyphRange.mock.calls[0].arguments[0], { stack: 'Arial', range: 0 });
    t.assert.deepStrictEqual(loadGlyphRange.mock.calls[1].arguments[0], { stack: 'Arial', range: 1 });

    t.assert.deepStrictEqual(result, {
      Arial: {
        0: { id: 0, data: 'glyph0' },
        1: { id: 1, data: 'glyph1' },
        257: null
      }
    });
  });

  await t.test('should cache glyph ranges to avoid redundant requests', async () => {
    const stacks = { Arial: [0, 1, 257] };
    const glyphData = Buffer.from('mocked data');
    const parsedGlyphs = [
      { id: 0, data: 'glyph0' },
      { id: 1, data: 'glyph1' }
    ];

    loadGlyphRange.mock.mockImplementation(() => Promise.resolve(glyphData));
    parseGlyphs.mock.mockImplementation(() => parsedGlyphs);

    await glyphs.getGlyphs({ stacks });
    await glyphs.getGlyphs({ stacks });

    t.assert.strictEqual(loadGlyphRange.mock.callCount(), 2); // Only two unique ranges requested
  });

  await t.test('should handle missing glyph data gracefully', async () => {
    const stacks = { Arial: [0, 1] };

    loadGlyphRange.mock.mockImplementation(() => Promise.resolve(null)); // Simulate missing data
    parseGlyphs.mock.mockImplementation(() => []);

    const result = await glyphs.getGlyphs({ stacks });

    t.assert.deepStrictEqual(result, {
      Arial: {
        0: null,
        1: null
      }
    });
  });
});

test('glyphCache - real data', async t => {
  function load() {
    return fs.readFile(path.resolve(__dirname, '../../../fixtures/0-255.pbf'));
  }

  await t.test('should parse glyph PBF', async () => {
    const loadGlyphRange = () => load();
    const glyphs = makeGlyphs({ loadGlyphRange, mapId: 'test-map-id' });

    const stacks = { Arial: [0, 1, 44, 55] };
    const result = await glyphs.getGlyphs({ stacks });

    t.assert.ok(result.Arial);
    t.assert.equal(Object.keys(result.Arial).length, 4);
    for (const [id, glyph] of Object.entries(result.Arial)) {
      t.assert.equal(id, glyph.id);
      t.assert.equal(typeof glyph.id, 'number');
      t.assert.ok(glyph.bitmap instanceof AlphaImage);
      t.assert.equal(typeof glyph.metrics, 'object');
      t.assert.equal(typeof glyph.metrics.width, 'number');
      t.assert.equal(typeof glyph.metrics.height, 'number');
      t.assert.equal(typeof glyph.metrics.top, 'number');
      t.assert.equal(typeof glyph.metrics.advance, 'number');
    }
  });
});
