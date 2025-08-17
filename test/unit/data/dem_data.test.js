const test = require('node:test');
const _window = require('../../util/window');
const DEMData = require('../../../src/data/dem_data');
const { RGBAImage } = require('../../../src/util/image');

function createMockImage(height, width) {
  const pixels = new Uint8Array(height * width * 4);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = (i + 1) % 4 === 0 ? 1 : Math.floor(Math.random() * 256);
  }
  return new RGBAImage({ height: height, width: width }, pixels);
}

test('DEMData', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('constructor', t => {
    const dem = new DEMData(0, { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) });
    t.assert.equal(dem.uid, 0);
    t.assert.equal(dem.dim, 4);
    t.assert.equal(dem.stride, 6);
    t.assert.ok(dem.data instanceof Int32Array);
  });

  await t.test('setters and getters throw for invalid data coordinates', t => {
    const dem = new DEMData(0, { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) });

    t.assert.throws(
      () => dem.set(20, 0, 255),
      { message: 'out of range source coordinates for DEM data' },
      'detects and throws on invalid input'
    );
    t.assert.throws(
      () => dem.set(10, 20, 255),
      { message: 'out of range source coordinates for DEM data' },
      'detects and throws on invalid input'
    );
  });

  await t.test('loadFromImage with invalid encoding', t => {
    const warn = t.mock.method(console, 'warn');

    const dem = new DEMData(0, { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4) }, 'derp');
    t.assert.equal(dem.uid, 0);
    t.assert.equal(warn.mock.callCount(), 1);
    t.assert.match(warn.mock.calls[0].arguments[0], /"derp" is not a valid encoding type/);
  });
});

test('DEMData.backfillBorder', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  const dem0 = new DEMData(0, createMockImage(4, 4));
  const dem1 = new DEMData(1, createMockImage(4, 4));

  await t.test('border region is initially populated with neighboring data', t => {
    let nonempty = true;
    for (let x = -1; x < 5; x++) {
      for (let y = -1; y < 5; y++) {
        if (dem0.get(x, y) === -65536) {
          nonempty = false;
          break;
        }
      }
    }
    t.assert.ok(nonempty, 'pixel data populates DEM data level');

    let verticalBorderMatch = true;
    for (const x of [-1, 4]) {
      for (let y = 0; y < 4; y++) {
        if (dem0.get(x, y) !== dem0.get(x < 0 ? x + 1 : x - 1, y)) {
          verticalBorderMatch = false;
          break;
        }
      }
    }
    t.assert.ok(verticalBorderMatch, 'vertical border of DEM data is initially equal to next column of data');

    // horizontal borders empty
    let horizontalBorderMatch = true;
    for (const y of [-1, 4]) {
      for (let x = 0; x < 4; x++) {
        if (dem0.get(x, y) !== dem0.get(x, y < 0 ? y + 1 : y - 1)) {
          horizontalBorderMatch = false;
          break;
        }
      }
    }
    t.assert.ok(horizontalBorderMatch, 'horizontal border of DEM data is initially equal to next row of data');

    t.assert.ok(dem0.get(-1, 4) === dem0.get(0, 3), '-1, 1 corner initially equal to closest corner data');
    t.assert.ok(dem0.get(4, 4) === dem0.get(3, 3), '1, 1 corner initially equal to closest corner data');
    t.assert.ok(dem0.get(-1, -1) === dem0.get(0, 0), '-1, -1 corner initially equal to closest corner data');
    t.assert.ok(dem0.get(4, -1) === dem0.get(3, 0), '-1, 1 corner initially equal to closest corner data');
  });

  await t.test('backfillBorder correctly populates borders with neighboring data', t => {
    dem0.backfillBorder(dem1, -1, 0);
    for (let y = 0; y < 4; y++) {
      // dx = -1, dy = 0, so the left edge of dem1 should equal the right edge of dem0
      t.assert.ok(dem0.get(-1, y) === dem1.get(3, y), 'backfills neighbor -1, 0');
    }

    dem0.backfillBorder(dem1, 0, -1);
    for (let x = 0; x < 4; x++) {
      t.assert.ok(dem0.get(x, -1) === dem1.get(x, 3), 'backfills neighbor 0, -1');
    }

    dem0.backfillBorder(dem1, 1, 0);
    for (let y = 0; y < 4; y++) {
      t.assert.ok(dem0.get(4, y) === dem1.get(0, y), 'backfills neighbor 1, 0');
    }

    dem0.backfillBorder(dem1, 0, 1);
    for (let x = 0; x < 4; x++) {
      t.assert.ok(dem0.get(x, 4) === dem1.get(x, 0), 'backfills neighbor 0, 1');
    }

    dem0.backfillBorder(dem1, -1, 1);
    t.assert.ok(dem0.get(-1, 4) === dem1.get(3, 0), 'backfills neighbor -1, 1');

    dem0.backfillBorder(dem1, 1, 1);
    t.assert.ok(dem0.get(4, 4) === dem1.get(0, 0), 'backfills neighbor 1, 1');

    dem0.backfillBorder(dem1, -1, -1);
    t.assert.ok(dem0.get(-1, -1) === dem1.get(3, 3), 'backfills neighbor -1, -1');

    dem0.backfillBorder(dem1, 1, -1);
    t.assert.ok(dem0.get(4, -1) === dem1.get(0, 3), 'backfills neighbor -1, 1');
  });
});
