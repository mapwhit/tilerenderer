const { RGBAImage } = require('../util/image');
const { register } = require('../util/transfer_registry');
const { default: potpack } = require('potpack');

const padding = 1;

class ImagePosition {
  constructor(paddedRect, { pixelRatio }) {
    this.paddedRect = paddedRect;
    this.pixelRatio = pixelRatio;
  }

  get tl() {
    return [this.paddedRect.x + padding, this.paddedRect.y + padding];
  }

  get br() {
    return [this.paddedRect.x + this.paddedRect.w - padding, this.paddedRect.y + this.paddedRect.h - padding];
  }

  get tlbr() {
    return this.tl.concat(this.br);
  }

  get displaySize() {
    return [(this.paddedRect.w - padding * 2) / this.pixelRatio, (this.paddedRect.h - padding * 2) / this.pixelRatio];
  }
}

class ImageAtlas {
  constructor(icons, patterns) {
    const iconPositions = {};
    const patternPositions = {};
    const bins = [];
    for (const id in icons) {
      const src = icons[id];
      const bin = {
        x: 0,
        y: 0,
        w: src.data.width + 2 * padding,
        h: src.data.height + 2 * padding
      };
      bins.push(bin);
      iconPositions[id] = new ImagePosition(bin, src);
    }

    for (const id in patterns) {
      const src = patterns[id];
      const bin = {
        x: 0,
        y: 0,
        w: src.data.width + 2 * padding,
        h: src.data.height + 2 * padding
      };
      bins.push(bin);
      patternPositions[id] = new ImagePosition(bin, src);
    }

    const { w, h } = potpack(bins);
    const image = new RGBAImage({ width: w || 1, height: h || 1 });

    for (const id in icons) {
      const src = icons[id];
      const bin = iconPositions[id].paddedRect;
      RGBAImage.copy(src.data, image, { x: 0, y: 0 }, { x: bin.x + padding, y: bin.y + padding }, src.data);
    }

    for (const id in patterns) {
      const src = patterns[id];
      const bin = patternPositions[id].paddedRect;
      const x = bin.x + padding;
      const y = bin.y + padding;
      const w = src.data.width;
      const h = src.data.height;

      RGBAImage.copy(src.data, image, { x: 0, y: 0 }, { x: x, y: y }, src.data);
      // Add 1 pixel wrapped padding on each side of the image.
      RGBAImage.copy(src.data, image, { x: 0, y: h - 1 }, { x: x, y: y - 1 }, { width: w, height: 1 }); // T
      RGBAImage.copy(src.data, image, { x: 0, y: 0 }, { x: x, y: y + h }, { width: w, height: 1 }); // B
      RGBAImage.copy(src.data, image, { x: w - 1, y: 0 }, { x: x - 1, y: y }, { width: 1, height: h }); // L
      RGBAImage.copy(src.data, image, { x: 0, y: 0 }, { x: x + w, y: y }, { width: 1, height: h }); // R
    }

    this.image = image;
    this.iconPositions = iconPositions;
    this.patternPositions = patternPositions;
  }
}

ImageAtlas.ImagePosition = ImagePosition;
module.exports = ImageAtlas;

register('ImagePosition', ImagePosition);
register('ImageAtlas', ImageAtlas);
