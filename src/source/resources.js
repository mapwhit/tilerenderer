module.exports = { resources };

function resources(actor, mapId) {
  return {
    getGlyphs,
    getImages
  };

  function getGlyphs(params) {
    return actor.send('getGlyphs', params, mapId);
  }

  function getImages(params) {
    return actor.send('getImages', params, mapId);
  }
}
