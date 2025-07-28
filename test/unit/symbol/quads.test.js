const test = require('node:test');
const { getIconQuads } = require('../../../src/symbol/quads');
const Anchor = require('../../../src/symbol/anchor');
const SymbolStyleLayer = require('../../../src/style/style_layer/symbol_style_layer');

function createLayer(layer) {
  const result = new SymbolStyleLayer(layer);
  result.recalculate({ zoom: 0, zoomHistory: {} });
  return result;
}

function createShapedIcon() {
  return {
    top: -5,
    bottom: 6,
    left: -7,
    right: 8,
    image: {
      pixelRatio: 1,
      paddedRect: { x: 0, y: 0, w: 17, h: 13 }
    }
  };
}

test('getIconQuads', async t => {
  await t.test('point', t => {
    const anchor = new Anchor(2, 3, 0, undefined);
    const layer = createLayer({
      layout: { 'icon-rotate': 0 }
    });
    t.assert.deepEqual(getIconQuads(anchor, createShapedIcon(), layer, false), [
      {
        tl: { x: -8, y: -6 },
        tr: { x: 9, y: -6 },
        bl: { x: -8, y: 7 },
        br: { x: 9, y: 7 },
        tex: { x: 0, y: 0, w: 17, h: 13 },
        writingMode: null,
        glyphOffset: [0, 0]
      }
    ]);
  });

  await t.test('line', t => {
    const anchor = new Anchor(2, 3, 0, 0);
    const layer = createLayer({
      layout: { 'icon-rotate': 0 }
    });
    t.assert.deepEqual(getIconQuads(anchor, createShapedIcon(), layer, false), [
      {
        tl: { x: -8, y: -6 },
        tr: { x: 9, y: -6 },
        bl: { x: -8, y: 7 },
        br: { x: 9, y: 7 },
        tex: { x: 0, y: 0, w: 17, h: 13 },
        writingMode: null,
        glyphOffset: [0, 0]
      }
    ]);
  });
});

test('getIconQuads text-fit', async t => {
  const anchor = new Anchor(0, 0, 0, undefined);
  function createShapedIcon() {
    return {
      top: -10,
      bottom: 10,
      left: -10,
      right: 10,
      image: {
        pixelRatio: 1,
        paddedRect: { x: 0, y: 0, w: 22, h: 22 }
      }
    };
  }

  function createshapedText() {
    return {
      top: -10,
      bottom: 30,
      left: -60,
      right: 20
    };
  }

  await t.test('icon-text-fit: none', t => {
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'icon-text-fit': 'none'
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -11, y: -11 });
    t.assert.deepEqual(quads[0].tr, { x: 11, y: -11 });
    t.assert.deepEqual(quads[0].bl, { x: -11, y: 11 });
    t.assert.deepEqual(quads[0].br, { x: 11, y: 11 });

    t.assert.deepEqual(
      quads,
      getIconQuads(
        anchor,
        createShapedIcon(),
        createLayer({
          layout: {
            'icon-text-fit': 'none',
            'icon-text-fit-padding': [10, 10]
          }
        }),
        false,
        createshapedText()
      ),
      'ignores padding'
    );
  });

  await t.test('icon-text-fit: width', t => {
    // - Uses text width
    // - Preserves icon height, centers vertically
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 24,
          'icon-text-fit': 'width',
          'icon-text-fit-padding': [0, 0, 0, 0]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -60, y: -1 });
    t.assert.deepEqual(quads[0].tr, { x: 20, y: -1 });
    t.assert.deepEqual(quads[0].bl, { x: -60, y: 21 });
    t.assert.deepEqual(quads[0].br, { x: 20, y: 21 });
  });

  await t.test('icon-text-fit: width, x textSize', t => {
    // - Uses text width (adjusted for textSize)
    // - Preserves icon height, centers vertically
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'width',
          'icon-text-fit-padding': [0, 0, 0, 0]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -30, y: -6 });
    t.assert.deepEqual(quads[0].tr, { x: 10, y: -6 });
    t.assert.deepEqual(quads[0].bl, { x: -30, y: 16 });
    t.assert.deepEqual(quads[0].br, { x: 10, y: 16 });
  });

  await t.test('icon-text-fit: width, x textSize, + padding', t => {
    // - Uses text width (adjusted for textSize)
    // - Preserves icon height, centers vertically
    // - Applies padding x, padding y
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'width',
          'icon-text-fit-padding': [5, 10, 5, 10]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -40, y: -11 });
    t.assert.deepEqual(quads[0].tr, { x: 20, y: -11 });
    t.assert.deepEqual(quads[0].bl, { x: -40, y: 21 });
    t.assert.deepEqual(quads[0].br, { x: 20, y: 21 });
  });

  await t.test('icon-text-fit: height', t => {
    // - Uses text height
    // - Preserves icon width, centers horizontally
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 24,
          'icon-text-fit': 'height',
          'icon-text-fit-padding': [0, 0, 0, 0]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -31, y: -10 });
    t.assert.deepEqual(quads[0].tr, { x: -9, y: -10 });
    t.assert.deepEqual(quads[0].bl, { x: -31, y: 30 });
    t.assert.deepEqual(quads[0].br, { x: -9, y: 30 });
  });

  await t.test('icon-text-fit: height, x textSize', t => {
    // - Uses text height (adjusted for textSize)
    // - Preserves icon width, centers horizontally
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'height',
          'icon-text-fit-padding': [0, 0, 0, 0]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -21, y: -5 });
    t.assert.deepEqual(quads[0].tr, { x: 1, y: -5 });
    t.assert.deepEqual(quads[0].bl, { x: -21, y: 15 });
    t.assert.deepEqual(quads[0].br, { x: 1, y: 15 });
  });

  await t.test('icon-text-fit: height, x textSize, + padding', t => {
    // - Uses text height (adjusted for textSize)
    // - Preserves icon width, centers horizontally
    // - Applies padding x, padding y
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'height',
          'icon-text-fit-padding': [5, 10, 5, 10]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -31, y: -10 });
    t.assert.deepEqual(quads[0].tr, { x: 11, y: -10 });
    t.assert.deepEqual(quads[0].bl, { x: -31, y: 20 });
    t.assert.deepEqual(quads[0].br, { x: 11, y: 20 });
  });

  await t.test('icon-text-fit: both', t => {
    // - Uses text width + height
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 24,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [0, 0, 0, 0]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -60, y: -10 });
    t.assert.deepEqual(quads[0].tr, { x: 20, y: -10 });
    t.assert.deepEqual(quads[0].bl, { x: -60, y: 30 });
    t.assert.deepEqual(quads[0].br, { x: 20, y: 30 });
  });

  await t.test('icon-text-fit: both, x textSize', t => {
    // - Uses text width + height (adjusted for textSize)
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [0, 0, 0, 0]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -30, y: -5 });
    t.assert.deepEqual(quads[0].tr, { x: 10, y: -5 });
    t.assert.deepEqual(quads[0].bl, { x: -30, y: 15 });
    t.assert.deepEqual(quads[0].br, { x: 10, y: 15 });
  });

  await t.test('icon-text-fit: both, x textSize, + padding', t => {
    // - Uses text width + height (adjusted for textSize)
    // - Applies padding x, padding y
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [5, 10, 5, 10]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -40, y: -10 });
    t.assert.deepEqual(quads[0].tr, { x: 20, y: -10 });
    t.assert.deepEqual(quads[0].bl, { x: -40, y: 20 });
    t.assert.deepEqual(quads[0].br, { x: 20, y: 20 });
  });

  await t.test('icon-text-fit: both, padding t/r/b/l', t => {
    // - Uses text width + height (adjusted for textSize)
    // - Applies padding t/r/b/l
    const quads = getIconQuads(
      anchor,
      createShapedIcon(),
      createLayer({
        layout: {
          'text-size': 12,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [0, 5, 10, 15]
        }
      }),
      false,
      createshapedText()
    );
    t.assert.deepEqual(quads[0].tl, { x: -45, y: -5 });
    t.assert.deepEqual(quads[0].tr, { x: 15, y: -5 });
    t.assert.deepEqual(quads[0].bl, { x: -45, y: 25 });
    t.assert.deepEqual(quads[0].br, { x: 15, y: 25 });
  });
});
