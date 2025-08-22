const { default: potpack } = require('potpack');

const { RGBAImage } = require('../util/image');
const { ImagePosition } = require('./image_atlas');
const Texture = require('./texture');
const assert = require('assert');

// When copied into the atlas texture, image data is padded by one pixel on each side. Icon
// images are padded with fully transparent pixels, while pattern images are padded with a
// copy of the image data wrapped from the opposite side. In both cases, this ensures the
// correct behavior of GL_LINEAR texture sampling mode.
const padding = 1;

/*
    ImageManager does two things:

        1. Tracks requests for icon images from tile workers and sends responses when the requests are fulfilled.
        2. Builds a texture atlas for pattern images.

    These are disparate responsibilities and should eventually be handled by different classes. When we implement
    data-driven support for `*-pattern`, we'll likely use per-bucket pattern atlases, and that would be a good time
    to refactor this.
*/
class ImageManager {
  #loadedState = Promise.withResolvers();
  #imageQueue = new Map();
  constructor() {
    this.images = new Map();

    this.patterns = new Map();
    this.atlasImage = new RGBAImage({ width: 1, height: 1 });
    this.dirty = true;
  }

  isLoaded() {
    return !!this.#loadedState.loaded;
  }

  setLoaded() {
    if (this.#loadedState.loaded) {
      return;
    }
    this.#loadedState.loaded = true;
    this.#loadedState.resolve();
  }

  getImage(id) {
    return this.images.get(id);
  }

  addImage(id, image) {
    assert(!(this.images.has(id) || this.#imageQueue.has(id)));
    if (image.promise) {
      this.#imageQueue.set(id, image.promise);
      image.promise.then(image => {
        this.#imageQueue.delete(id);
        this.images.set(id, image);
      });
      return;
    }
    this.images.set(id, image);
  }

  removeImage(id) {
    assert(this.images.has(id) || this.#imageQueue.has(id));
    this.images.delete(id);
    this.#imageQueue.delete(id);
    this.patterns.delete(id);
  }

  listImages() {
    return Array.from(this.images.keys());
  }

  async getImages(ids) {
    await this.#loadedState.promise;

    const response = {};
    for (const id of ids) {
      let image = this.images.get(id);
      if (!image) {
        if (!this.#imageQueue.has(id)) {
          continue;
        }
        image = await this.#imageQueue.get(id);
      }
      if (image) {
        response[id] = {
          data: image.data,
          pixelRatio: image.pixelRatio,
          sdf: image.sdf
        };
      }
    }
    return response;
  }

  // Pattern stuff

  getPixelSize() {
    const { width, height } = this.atlasImage;
    return { width, height };
  }

  getPattern(id) {
    const pattern = this.patterns.get(id);
    if (pattern) {
      return pattern.position;
    }

    const image = this.getImage(id);
    if (!image) {
      return null;
    }

    const w = image.data.width + padding * 2;
    const h = image.data.height + padding * 2;
    const bin = { w, h, x: 0, y: 0 };
    const position = new ImagePosition(bin, image);
    this.patterns.set(id, { bin, position });
    this._updatePatternAtlas();

    return position;
  }

  bind(context) {
    const gl = context.gl;
    if (!this.atlasTexture) {
      this.atlasTexture = new Texture(context, this.atlasImage, gl.RGBA);
    } else if (this.dirty) {
      this.atlasTexture.update(this.atlasImage);
      this.dirty = false;
    }

    this.atlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
  }

  _updatePatternAtlas() {
    const bins = [];
    for (const { bin } of this.patterns.values()) {
      bins.push(bin);
    }

    const { w, h } = potpack(bins);

    const dst = this.atlasImage;
    dst.resize({ width: w ?? 1, height: h ?? 1 });

    for (const [id, { bin }] of this.patterns) {
      const x = bin.x + padding;
      const y = bin.y + padding;
      const src = this.images.get(id).data;
      const w = src.width;
      const h = src.height;

      RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x, y }, { width: w, height: h });

      // Add 1 pixel wrapped padding on each side of the image.
      RGBAImage.copy(src, dst, { x: 0, y: h - 1 }, { x: x, y: y - 1 }, { width: w, height: 1 }); // T
      RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x: x, y: y + h }, { width: w, height: 1 }); // B
      RGBAImage.copy(src, dst, { x: w - 1, y: 0 }, { x: x - 1, y: y }, { width: 1, height: h }); // L
      RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x: x + w, y: y }, { width: 1, height: h }); // R
    }

    this.dirty = true;
  }
}

module.exports = ImageManager;
