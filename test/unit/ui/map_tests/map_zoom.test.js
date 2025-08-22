const test = require('node:test');
const { createMap, initWindow } = require('../../../util/util');

test('map zoom', async t => {
  initWindow(t);

  await t.test('setMinZoom', t => {
    const map = createMap({ zoom: 5 });
    map.setMinZoom(3.5);
    map.setZoom(1);
    t.assert.equal(map.getZoom(), 3.5);
  });

  await t.test('unset minZoom', t => {
    const map = createMap({ minZoom: 5 });
    map.setMinZoom(null);
    map.setZoom(1);
    t.assert.equal(map.getZoom(), 1);
  });

  await t.test('getMinZoom', t => {
    const map = createMap({ zoom: 0 });
    t.assert.equal(map.getMinZoom(), 0, 'returns default value');
    map.setMinZoom(10);
    t.assert.equal(map.getMinZoom(), 10, 'returns custom value');
  });

  await t.test('ignore minZooms over maxZoom', async t => {
    const map = createMap({ zoom: 2, maxZoom: 5 });
    t.assert.throws(() => {
      map.setMinZoom(6);
    });
    map.setZoom(0);
    t.assert.equal(map.getZoom(), 0);
  });

  await t.test('setMaxZoom', t => {
    const map = createMap({ zoom: 0 });
    map.setMaxZoom(3.5);
    map.setZoom(4);
    t.assert.equal(map.getZoom(), 3.5);
  });

  await t.test('unset maxZoom', t => {
    const map = createMap({ maxZoom: 5 });
    map.setMaxZoom(null);
    map.setZoom(6);
    t.assert.equal(map.getZoom(), 6);
  });

  await t.test('getMaxZoom', t => {
    const map = createMap({ zoom: 0 });
    t.assert.equal(map.getMaxZoom(), 22, 'returns default value');
    map.setMaxZoom(10);
    t.assert.equal(map.getMaxZoom(), 10, 'returns custom value');
  });

  await t.test('ignore maxZooms over minZoom', async t => {
    const map = createMap({ minZoom: 5 });
    t.assert.throws(() => {
      map.setMaxZoom(4);
    });
    map.setZoom(5);
    t.assert.equal(map.getZoom(), 5);
  });

  await t.test('throw on maxZoom smaller than minZoom at init', async t => {
    t.assert.throws(() => {
      createMap({ minZoom: 10, maxZoom: 5 });
    }, new Error('maxZoom must be greater than minZoom'));
  });

  await t.test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', async t => {
    t.assert.throws(() => {
      createMap({ minZoom: 1, maxZoom: 0 });
    }, new Error('maxZoom must be greater than minZoom'));
  });
});
