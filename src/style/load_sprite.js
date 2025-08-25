import browser from '../util/browser.js';
import { RGBAImage } from '../util/image.js';
import loadImage from '../util/loader/image.js';
export default loadSprite;

async function loadSprite(loadingSprite) {
  const sprite = await loadingSprite;
  const image = await loadImage(sprite.image);
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

    return result;
  }
}
