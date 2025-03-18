const ShelfPack = require('@mapbox/shelf-pack');

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
  constructor() {
    this.images = {};

    this.shelfPack = new ShelfPack(64, 64, { autoResize: true });
    this.patterns = {};
    this.atlasImage = new RGBAImage({ width: 64, height: 64 });
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
    return this.images[id];
  }

  addImage(id, image) {
    assert(!this.images[id]);
    this.images[id] = image;
  }

  removeImage(id) {
    assert(this.images[id]);
    delete this.images[id];

    const pattern = this.patterns[id];
    if (pattern) {
      this.shelfPack.unref(pattern.bin);
      delete this.patterns[id];
    }
  }

  listImages() {
    return Object.keys(this.images);
  }

  async getImages(ids) {
    await this.#loadedState.promise;

    const response = {};
    for (const id of ids) {
      const image = this.images[id];
      if (image) {
        // Clone the image so that our own copy of its ArrayBuffer doesn't get transferred.
        response[id] = {
          data: image.data.clone(),
          pixelRatio: image.pixelRatio,
          sdf: image.sdf
        };
      }
    }
    return response;
  }

  // Pattern stuff

  getPixelSize() {
    return {
      width: this.shelfPack.w,
      height: this.shelfPack.h
    };
  }

  getPattern(id) {
    const pattern = this.patterns[id];
    if (pattern) {
      return pattern.position;
    }

    const image = this.getImage(id);
    if (!image) {
      return null;
    }

    const width = image.data.width + padding * 2;
    const height = image.data.height + padding * 2;

    const bin = this.shelfPack.packOne(width, height);
    if (!bin) {
      return null;
    }

    this.atlasImage.resize(this.getPixelSize());

    const src = image.data;
    const dst = this.atlasImage;

    const x = bin.x + padding;
    const y = bin.y + padding;
    const w = src.width;
    const h = src.height;

    RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x, y }, { width: w, height: h });

    // Add 1 pixel wrapped padding on each side of the image.
    RGBAImage.copy(src, dst, { x: 0, y: h - 1 }, { x: x, y: y - 1 }, { width: w, height: 1 }); // T
    RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x: x, y: y + h }, { width: w, height: 1 }); // B
    RGBAImage.copy(src, dst, { x: w - 1, y: 0 }, { x: x - 1, y: y }, { width: 1, height: h }); // L
    RGBAImage.copy(src, dst, { x: 0, y: 0 }, { x: x + w, y: y }, { width: 1, height: h }); // R

    this.dirty = true;

    const position = new ImagePosition(bin, image);
    this.patterns[id] = { bin, position };
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
}

module.exports = ImageManager;
