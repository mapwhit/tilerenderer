const test = require('node:test');
const _window = require('../../util/window');
const ImageSource = require('../../../src/source/image_source');
const { Evented } = require('@mapwhit/events');
const Transform = require('../../../src/geo/transform');
const browser = require('../../../src/util/browser');

function createSource(options) {
  options = Object.assign(
    {
      coordinates: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ]
    },
    options
  );

  const source = new ImageSource('id', options, options.eventedParent);
  return source;
}

class StubMap extends Evented {
  constructor() {
    super();
    this.transform = new Transform();
  }
}

test('ImageSource', async t => {
  let globalWindow;
  let respond;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;

    t.mock.method(window.URL, 'createObjectURL', () => 'blob:');
    // stub Image so we can invoke 'onload'
    // https://github.com/jsdom/jsdom/commit/58a7028d0d5b6aacc5b435daee9fd8f9eacbb14c
    const img = {};
    t.mock.method(window, 'Image', function () {
      return img;
    });
    respond = () => {
      img.onload();
    };
    t.mock.method(browser, 'getImageData', () => new ArrayBuffer(1));
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('constructor', t => {
    const source = createSource({ url: new ArrayBuffer(0) });

    t.assert.equal(source.minzoom, 0);
    t.assert.equal(source.maxzoom, 22);
    t.assert.equal(source.tileSize, 512);
  });

  await t.test('fires dataloading event', (t, done) => {
    const source = createSource({ url: new ArrayBuffer(0) });
    source.on('dataloading', e => {
      t.assert.equal(e.dataType, 'source');
      done();
    });
    source.onAdd(new StubMap());
    respond();
  });

  await t.test('fires data event when content is loaded', (t, done) => {
    const source = createSource({ url: new ArrayBuffer(0) });
    source.on('data', e => {
      if (e.dataType === 'source' && e.sourceDataType === 'content') {
        t.assert.equal(typeof source.tileID, 'object');
        done();
      }
    });
    source.onAdd(new StubMap());
    respond();
  });

  await t.test('fires data event when metadata is loaded', (t, done) => {
    const source = createSource({ url: new ArrayBuffer(0) });
    source.on('data', e => {
      if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
        done();
      }
    });
    source.onAdd(new StubMap());
    respond();
  });

  await t.test('serialize url and coordinates', t => {
    const url = new ArrayBuffer(0);
    const source = createSource({ url });

    const serialized = source.serialize();
    t.assert.equal(serialized.type, 'image');
    t.assert.equal(serialized.url, url);
    t.assert.deepEqual(serialized.coordinates, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1]
    ]);
  });
});
