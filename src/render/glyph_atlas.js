const { AlphaImage } = require('../util/image');
const { default: potpack } = require('potpack');

const padding = 1;

class GlyphAtlas {
  constructor(stacks) {
    const positions = {};
    const bins = [];

    for (const stack in stacks) {
      const glyphs = stacks[stack];
      const stackPositions = (positions[stack] = {});

      for (const id in glyphs) {
        const src = glyphs[+id];
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

        const bin = {
          x: 0,
          y: 0,
          w: src.bitmap.width + 2 * padding,
          h: src.bitmap.height + 2 * padding
        };
        bins.push(bin);
        stackPositions[id] = { rect: bin, metrics: src.metrics };
      }
    }

    const { w, h } = potpack(bins);
    const image = new AlphaImage({ width: w ?? 1, height: h ?? 1 });

    for (const stack in stacks) {
      const glyphs = stacks[stack];

      for (const id in glyphs) {
        const src = glyphs[+id];
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;
        const bin = positions[stack][id].rect;
        AlphaImage.copy(src.bitmap, image, { x: 0, y: 0 }, { x: bin.x + padding, y: bin.y + padding }, src.bitmap);
      }
    }

    this.image = image;
    this.positions = positions;
  }
}

module.exports = GlyphAtlas;
