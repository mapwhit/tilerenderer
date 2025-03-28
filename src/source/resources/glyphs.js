const parseGlyphPBF = require('../../style/parse_glyph_pbf');

module.exports = glyphCache;

function glyphCache({ actor, mapId }) {
  const entries = {};

  return {
    getGlyphs
  };

  async function getGlyphs({ stacks }) {
    const all = [];
    for (const [stack, ids] of Object.entries(stacks)) {
      for (const id of ids) {
        all.push(retrieveGlyph({ stack, id }));
      }
    }
    // FIXME: one promise per range, not per glyph
    const fetchedGlyphs = await Promise.all(all);
    const result = {};
    for (const { stack, id, glyph } of fetchedGlyphs) {
      (result[stack] ??= {})[id] = glyph;
    }
    return result;
  }

  async function retrieveGlyph({ stack, id }) {
    if (id > 65535) {
      // glyphs > 65535 not supported
      return { stack, id, glyph: null };
    }
    const entry = (entries[stack] ??= { glyphs: {}, requests: {} });

    const glyph = entry.glyphs[id];
    if (glyph) {
      return { stack, id, glyph };
    }

    const range = Math.floor(id / 256);
    const promise = (entry.requests[range] ??= actor.send('loadGlyphRange', { stack, range }, mapId));
    const data = await promise;
    delete entry.requests[range];
    if (!data) {
      return { stack, id, glyph: null };
    }
    for (const glyph of parseGlyphPBF(data)) {
      entry[glyph.id] = glyph;
    }
    return { stack, id, glyph: entry[id] || null };
  }
}
