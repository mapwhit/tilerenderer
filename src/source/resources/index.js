const makeGlyphs = require('./glyphs');

module.exports = { resources };

function resources(actor, mapId) {
  const glyphs = makeGlyphs({ actor, mapId });
  return {
    getGlyphs,
    getImages
  };

  function getGlyphs(params) {
    return glyphs.getGlyphs(params);
  }

  function getImages(params) {
    return actor.send('getImages', params, mapId);
  }
}
