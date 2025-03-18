const loadGlyphRange = require('../style/load_glyph_range');

const TinySDF = require('@mapbox/tiny-sdf');
const isChar = require('../util/is_char_in_unicode_block');
const { AlphaImage } = require('../util/image');

class GlyphManager {
  // exposed as statics to enable stubbing in unit tests
  static loadGlyphRange = loadGlyphRange;
  static TinySDF = TinySDF;

  constructor(localIdeographFontFamily) {
    this.localIdeographFontFamily = localIdeographFontFamily;
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

    async function retrieveGlyph({ entries, loader, localIdeographFontFamily }, { stack, id }) {
      const entry = (entries[stack] ??= { glyphs: {}, requests: {} });

      let glyph = entry.glyphs[id];
      if (glyph) {
        return { stack, id, glyph };
      }

      glyph = tinySDF(localIdeographFontFamily, entry, stack, id);
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

/**
 * Creates a glyph descriptor for a character using TinySDF if the character belongs to
 * the CJK Unified Ideographs or Hangul Syllables ranges.
 *
 * The function checks if the provided font family is valid and whether the Unicode code
 * point (id) falls within the supported character ranges. If so, it creates or reuses a
 * TinySDF instance from the given entry to generate a bitmap for the character.
 *
 * @param {string} family - The font family to be used for rendering the glyph.
 * @param {Object} entry - An object containing glyph-related data. May store a cached TinySDF instance.
 * @param {string} stack - A string representing the font style stack (e.g., "bold", "medium", "light") to determine the font weight.
 * @param {number} id - The Unicode code point of the character to render.
 * @returns {Object|undefined} An object with the glyph descriptor containing:
 *   - id {number}: The Unicode code point.
 *   - bitmap {AlphaImage}: An image instance created from the glyph bitmap.
 *   - metrics {Object}: An object containing rendering metrics:
 *       - width {number}: The width of the glyph.
 *       - height {number}: The height of the glyph.
 *       - left {number}: The left bearing for the glyph.
 *       - top {number}: The top bearing for the glyph (used for vertical offset).
 *       - advance {number}: The advance width for spacing the glyph.
 *
 * Returns undefined if no font family is provided or if the character is not within the supported ranges.
 */
function tinySDF(family, entry, stack, id) {
  if (!family) {
    return;
  }

  if (!isChar['CJK Unified Ideographs'](id) && !isChar['Hangul Syllables'](id)) {
    return;
  }

  const tinySDF = getTinySDF();
  return {
    id,
    bitmap: new AlphaImage({ width: 30, height: 30 }, tinySDF.draw(String.fromCharCode(id))),
    metrics: {
      width: 24,
      height: 24,
      left: 0,
      top: -8,
      advance: 24
    }
  };

  function getTinySDF() {
    const { tinySDF } = entry;
    if (tinySDF) {
      return tinySDF;
    }
    let fontWeight = '400';
    if (/bold/i.test(stack)) {
      fontWeight = '900';
    } else if (/medium/i.test(stack)) {
      fontWeight = '500';
    } else if (/light/i.test(stack)) {
      fontWeight = '200';
    }
    return (entry.tinySDF = new GlyphManager.TinySDF(24, 3, 8, 0.25, family, fontWeight));
  }
}
