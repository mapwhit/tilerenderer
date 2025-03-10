const browser = require('../util/browser');
const { RGBAImage } = require('../util/image');
const loadImage = require('../util/loader/image');

module.exports = loadSprite;

function loadSprite(sprite, callback) {
  loadImage(sprite.image).then(image => {
    const { json } = sprite;
    if (json && image) {
      const imageData = browser.getImageData(image);
      const result = {};

      for (const id in json) {
        const { width, height, x, y, sdf, pixelRatio } = json[id];
        const data = new RGBAImage({ width, height });
        RGBAImage.copy(imageData, data, { x, y }, { x: 0, y: 0 }, { width, height });
        result[id] = { data, pixelRatio, sdf };
      }

      callback(null, result);
    }
  }, callback);
}
