import test from 'node:test';
import { createMap, initWindow } from '../../../util/util.js';

const dataUrl =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNiIgaGVpZ2h0PSIzMCI+PHBhdGggZD0iTTAgMEgyNlYyNkgxNkwxMyAzMEwxMCAyNkgwWiIgZmlsbD0iIzY2NjY2NiIvPjxwYXRoIGQ9Ik0yIDJIMjRWMjRIMloiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMjEgMTUuNUwyMS43IDkuNiAxNi4zIDcuNSAxNC42IDguM0MxNC42IDguNiAxNC41IDguOSAxNC40IDkuMUwxNS43IDguNSAxNS4yIDE0LjIgMTUuMiAxNC41IDExLjIgMTUuMSAxMC45IDE1LjggMTUuMiAxNS4xIDE1LjcgMjAuMiAxNi4zIDIwLjIgMTUuOCAxNSAxNS45IDE1IDIwLjQgMTUuNiAyMC40IDE1LjUgMjEuMSAyMS4yIDE2LjQgMjAuMiAxMC4zIDIxLjMgMTAuMiAyMS4zIDEwLjggMTYuMSAxMC44IDE2LjEgMTAuNyAxNS45IDEwIDE0LjQgMTAuMSAxNS4zIDkuOSAxNS4zIDUuNiAxNC43IDUuNiAxNC40IDQuOSA5LjIgOCAxMC41IDcuNyA5LjlDNy43IDkuOCA3LjYgOS43IDcuNSA5LjZMNC4yIDguMiA1IDE0LjQgNSAxNC42IDUgMTQuNiA0LjkgMTUuMSA0LjkgMTUuMSA0LjMgMjAuOCAxMC4zIDIxLjkgMTYuNCAyMC44IDIxLjggMjJaTTE1LjkgMTQuNEwxNS44IDE0LjUgMTUuNyAxNC4yIDE2LjMgOC4yIDE2LjQgOC4yIDIxLjEgOS45IDIwLjUgMTVaTTkuNiAyMS4yTDQuOSAyMC4zIDUuNSAxNS4yIDkuOSAxNS45IDEwLjEgMTUuOSAxMC4yIDE2LjFaTTEwLjggMTZMMTAuNyAxNS45IDEwLjcgMTUuOCAxMC45IDE1LjhaTTguMiA5LjRMMTAuOCAxNC41IDEzLjMgOS41QzEzLjggOC45IDE0LjEgOC4yIDE0LjEgNy4zIDE0LjEgNS41IDEyLjYgNCAxMC44IDQgOC45IDQgNy40IDUuNSA3LjQgNy4zIDcuNCA4LjEgNy43IDguOSA4LjIgOS40Wk0xMC44IDUuM0MxMS45IDUuMyAxMi44IDYuMiAxMi44IDcuMyAxMi44IDguNSAxMS45IDkuNCAxMC44IDkuNFM4LjcgOC41IDguNyA3LjNDOC43IDYuMiA5LjcgNS4zIDEwLjggNS4zWiIgZmlsbD0iIzY2NjY2NiIvPjwvc3ZnPg==';

test('Map images', async t => {
  initWindow(t);

  await t.test('listImages', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      t.assert.equal(map.listImages().length, 0);

      map.addImage('img', { width: 1, height: 1, data: new Uint8Array(4) });

      const images = map.listImages();
      t.assert.equal(images.length, 1);
      t.assert.equal(images[0], 'img');
      done();
    });
  });

  await t.test('listImages throws an error if called before "load"', t => {
    const map = createMap();
    t.assert.throws(() => {
      map.listImages();
    }, Error);
  });

  await t.test('map getImage matches addImage, HTMLImageElement', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-html';
      const inputImage = document.createElement('img');
      inputImage.width = 26;
      inputImage.height = 30;
      inputImage.src = dataUrl;
      inputImage.decode().then(() => {
        map.addImage(id, inputImage);
        t.assert.equal(map.hasImage(id), true);

        const gotImage = map.getImage(id);
        t.assert.equal(gotImage.data.width, 26);
        t.assert.equal(gotImage.data.height, 30);
        t.assert.equal(gotImage.sdf, false);
        done();
      });
    });
  });

  await t.test('map getImage matches addImage, HTMLImageElement loading', (t, done) => {
    createMap({}, async (error, map) => {
      t.assert.ifError(error);

      const id = 'add-get-html-loading';
      const inputImage = document.createElement('img');
      inputImage.width = 26;
      inputImage.height = 30;
      inputImage.src = dataUrl;

      map.addImage(id, inputImage);
      t.assert.equal(map.hasImage(id), false); // not yet loaded

      const response = await map.style.imageManager.getImages([id]);
      t.assert.equal(response[id].data.width, 26);
      t.assert.equal(response[id].data.height, 30);
      t.assert.equal(response[id].sdf, false);

      t.assert.equal(map.hasImage(id), true); // loaded

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, 26);
      t.assert.equal(gotImage.data.height, 30);
      t.assert.equal(gotImage.sdf, false);
      done();
    });
  });

  await t.test('map getImage matches addImage, uintArray', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-uint';
      const inputImage = { width: 2, height: 1, data: new Uint8Array(8) };

      map.addImage(id, inputImage);
      t.assert.equal(map.hasImage(id), true);

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, inputImage.width);
      t.assert.equal(gotImage.data.height, inputImage.height);
      t.assert.equal(gotImage.sdf, false);
      done();
    });
  });

  await t.test('map getImage matches addImage, uintClampedArray', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-uint-clamped';
      const inputImage = { width: 1, height: 2, data: new Uint8ClampedArray(8) };

      map.addImage(id, inputImage);
      t.assert.equal(map.hasImage(id), true);

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, inputImage.width);
      t.assert.equal(gotImage.data.height, inputImage.height);
      t.assert.equal(gotImage.sdf, false);
      done();
    });
  });

  await t.test('map getImage matches addImage, ImageData', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-image-data';
      const inputImage = new ImageData(1, 3);

      map.addImage(id, inputImage);
      t.assert.equal(map.hasImage(id), true);

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, inputImage.width);
      t.assert.equal(gotImage.data.height, inputImage.height);
      t.assert.equal(gotImage.sdf, false);
      done();
    });
  });

  await t.test('map getImage matches addImage, StyleImageInterface uint', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-style-image-iface-uint';
      const inputImage = {
        width: 3,
        height: 1,
        data: new Uint8Array(12)
      };

      map.addImage(id, inputImage);
      t.assert.equal(map.hasImage(id), true);

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, inputImage.width);
      t.assert.equal(gotImage.data.height, inputImage.height);
      t.assert.equal(gotImage.sdf, false);
      done();
    });
  });

  await t.test('map getImage matches addImage, StyleImageInterface clamped', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-style-image-iface-clamped';
      const inputImage = {
        width: 4,
        height: 1,
        data: new Uint8ClampedArray(16)
      };

      map.addImage(id, inputImage);
      t.assert.equal(map.hasImage(id), true);

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, inputImage.width);
      t.assert.equal(gotImage.data.height, inputImage.height);
      t.assert.equal(gotImage.sdf, false);
      done();
    });
  });

  await t.test('map getImage matches addImage, StyleImageInterface SDF', (t, done) => {
    createMap({}, (error, map) => {
      t.assert.ifError(error);
      const id = 'add-get-style-image-iface-sdf';
      const inputImage = {
        width: 5,
        height: 1,
        data: new Uint8Array(20)
      };

      map.addImage(id, inputImage, { sdf: true });
      t.assert.equal(map.hasImage(id), true);

      const gotImage = map.getImage(id);
      t.assert.equal(gotImage.data.width, inputImage.width);
      t.assert.equal(gotImage.data.height, inputImage.height);
      t.assert.equal(gotImage.sdf, true);
      done();
    });
  });
});
