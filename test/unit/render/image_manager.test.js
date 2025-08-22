const test = require('node:test');
const ImageManager = require('../../../src/render/image_manager');

test('ImageManager', async t => {
  let imageManager;

  t.beforeEach(t => {
    imageManager = new ImageManager();
  });

  await t.test('should add/remove image', () => {
    const image = { pixelRatio: 1 };
    imageManager.addImage('test-image', image);
    t.assert.deepEqual(imageManager.getImage('test-image'), image);
    t.assert.deepEqual(imageManager.listImages(), ['test-image']);
    imageManager.removeImage('test-image');
    t.assert.equal(imageManager.getImage('test-image'), undefined);
    t.assert.deepEqual(imageManager.listImages(), []);
  });

  await t.test('should get images', async () => {
    imageManager.setLoaded();
    const image = { data: 'xyz', pixelRatio: 1, sdf: false };
    imageManager.addImage('image-1', image);
    imageManager.addImage('image-2', { promise: new Promise(resolve => setTimeout(() => resolve(image), 0)) });
    const response = await imageManager.getImages(['image-1', 'image-2', 'image-3']);
    t.assert.deepEqual(response, { 'image-1': image, 'image-2': image });
  });
});
