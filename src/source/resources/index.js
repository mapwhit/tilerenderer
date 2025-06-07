const makeGlyphs = require('./glyphs');
const makeImages = require('./images');

module.exports = { resources };

function resources(actor, mapId) {
  const glyphs = makeGlyphs({ actor, mapId });
  const images = makeImages({ actor, mapId });

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
