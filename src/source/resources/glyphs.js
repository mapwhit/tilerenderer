const parseGlyphPBF = require('../../style/parse_glyph_pbf');

module.exports = glyphCache;

const MAX_GLYPH_ID = 65535;

function glyphCache({ loadGlyphRange: loadGlyphRangeFromStyle, parseGlyphs = parseGlyphPBF }) {
  const entries = {};

  return {
    getGlyphs
  };

  async function getGlyphs({ stacks }) {
    const all = [];
    for (const [stack, ids] of Object.entries(stacks)) {
      const addedRanges = new Set();
      for (const id of ids) {
        if (id > MAX_GLYPH_ID) {
          continue;
        }
        const range = Math.floor(id / 256);
        if (!addedRanges.has(range) && !hasRange(stack, range)) {
          addedRanges.add(range);
          all.push(retrieveGlyphRange({ stack, range }));
        }
      }
    }
    if (all.length > 0) {
      await Promise.all(all);
    }
    const result = {};
    for (const [stack, ids] of Object.entries(stacks)) {
      const entry = getEntry(stack);
      const resultStack = (result[stack] ??= {});
      for (const id of ids) {
        if (id <= MAX_GLYPH_ID) {
          resultStack[id] = entry.glyphs[id] ?? null;
        } else {
          resultStack[id] = null;
        }
      }
    }
    return result;
  }

  async function retrieveGlyphRange({ stack, range }) {
    const entry = getEntry(stack);
    const data = await loadGlyphRange(entry, stack, range);
    if (!data) {
      return null;
    }
    for (const glyph of parseGlyphs(data)) {
      entry.glyphs[glyph.id] = glyph;
    }
  }

  async function loadGlyphRange(entry, stack, range) {
    const promise = (entry.requests[range] ??= loadGlyphRangeFromStyle({ stack, range }));
    const data = await promise;
    delete entry.requests[range];
    entry.ranges[range] = true;
    return data;
  }

  function getEntry(stack) {
    return (entries[stack] ??= { glyphs: {}, requests: {}, ranges: {} });
  }

  function hasRange(stack, range) {
    return getEntry(stack).ranges[range];
  }
}
