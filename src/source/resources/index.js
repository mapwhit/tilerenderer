import makeGlyphs from './glyphs.js';

export function resources(opts) {
  const glyphs = makeGlyphs(opts);

  return {
    getGlyphs,
    getImages: opts.getImages
  };

  function getGlyphs(params) {
    return glyphs.getGlyphs(params);
  }
}
