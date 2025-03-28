const { test } = require('../../util/mapbox-gl-js-test');
const parseGlyphPBF = require('../../../src/style/parse_glyph_pbf');
const GlyphManager = require('../../../src/render/glyph_manager');
const fs = require('fs');

const glyphs = {};
for (const glyph of parseGlyphPBF(fs.readFileSync('./test/fixtures/0-255.pbf'))) {
  glyphs[glyph.id] = glyph;
}

test('GlyphManager requests 0-255 PBF', async t => {
  function glyphLoader() {}

  t.stub(GlyphManager, 'loadGlyphRange').callsFake((stack, range, load) => {
    t.assert.equal(stack, 'Arial Unicode MS');
    t.assert.equal(range, 0);
    t.assert.equal(load, glyphLoader);
    return Promise.resolve(glyphs);
  });

  const manager = new GlyphManager();
  manager.setGlyphsLoader(glyphLoader);

  const result = await manager.getGlyphs({ 'Arial Unicode MS': [55] });
  t.assert.equal(result['Arial Unicode MS']['55'].metrics.advance, 12);
});

test('GlyphManager requests remote CJK PBF', async t => {
  t.stub(GlyphManager, 'loadGlyphRange').callsFake(() => {
    return Promise.resolve(glyphs);
  });

  const manager = new GlyphManager();
  manager.setGlyphsLoader(() => {});

  const result = await manager.getGlyphs({ 'Arial Unicode MS': [0x5e73] });
  t.assert.equal(result['Arial Unicode MS'][0x5e73], null, 'The fixture returns a PBF without the glyph we requested');
});
