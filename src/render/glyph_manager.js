const loadGlyphRange = require('../style/load_glyph_range');

class GlyphManager {
  // exposed as statics to enable stubbing in unit tests
  static loadGlyphRange = loadGlyphRange;

  constructor() {
    this.entries = {};
  }

  setGlyphsLoader(loader) {
    this.loader = loader;
  }

  async getGlyphs(glyphs) {
    const all = [];
    for (const stack in glyphs) {
      for (const id of glyphs[stack]) {
        all.push(retrieveGlyph(this, { stack, id }));
      }
    }
    const fetchedGlyphs = await Promise.all(all);
    const result = {};
    for (const { stack, id, glyph } of fetchedGlyphs) {
      // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
      (result[stack] ??= {})[id] = cloneGlyph(glyph);
    }
    return result;

    function cloneGlyph(glyph) {
      if (glyph) {
        return {
          id: glyph.id,
          bitmap: glyph.bitmap.clone(),
          metrics: glyph.metrics
        };
      }
    }

    async function retrieveGlyph({ entries, loader }, { stack, id }) {
      const entry = (entries[stack] ??= { glyphs: {}, requests: {} });

      const glyph = entry.glyphs[id];
      if (glyph) {
        return { stack, id, glyph };
      }

      const range = Math.floor(id / 256);
      if (range * 256 > 65535) {
        throw new Error('glyphs > 65535 not supported');
      }

      const promise = (entry.requests[range] ??= GlyphManager.loadGlyphRange(stack, range, loader));
      const response = await promise;
      if (response) {
        for (const id in response) {
          entry.glyphs[+id] = response[+id];
        }
      }
      delete entry.requests[range];
      return { stack, id, glyph: response?.[id] || null };
    }
  }
}

module.exports = GlyphManager;
