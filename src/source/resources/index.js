const makeGlyphs = require('./glyphs');
const makeImages = require('./images');

module.exports = { resources };

function resources(opts) {
  const glyphs = makeGlyphs(opts);
  const images = makeImages(opts);

  return {
    getGlyphs,
    getImages
  };

  function getGlyphs(params) {
    return glyphs.getGlyphs(params);
  }

  function getImages(params) {
    return images.getImages(params);
  }
}
