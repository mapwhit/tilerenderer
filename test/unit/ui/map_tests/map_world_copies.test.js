const test = require('node:test');
const { createMap, initWindow } = require('../../../util/util');

test('getRenderWorldCopies', async t => {
  initWindow(t);

  await t.test('initially false', t => {
    const map = createMap({ renderWorldCopies: false });
    t.assert.equal(map.getRenderWorldCopies(), false);
  });

  await t.test('initially true', t => {
    const map = createMap({ renderWorldCopies: true });
    t.assert.equal(map.getRenderWorldCopies(), true);
  });
});

test('setRenderWorldCopies', async t => {
  initWindow(t);

  await t.test('initially false', t => {
    const map = createMap({ renderWorldCopies: false });
    map.setRenderWorldCopies(true);
    t.assert.equal(map.getRenderWorldCopies(), true);
  });

  await t.test('initially true', t => {
    const map = createMap({ renderWorldCopies: true });
    map.setRenderWorldCopies(false);
    t.assert.equal(map.getRenderWorldCopies(), false);
  });

  await t.test('undefined', t => {
    const map = createMap({ renderWorldCopies: false });
    map.setRenderWorldCopies(undefined);
    t.assert.equal(map.getRenderWorldCopies(), true);
  });

  await t.test('null', t => {
    const map = createMap({ renderWorldCopies: true });
    map.setRenderWorldCopies(null);
    t.assert.equal(map.getRenderWorldCopies(), false);
  });
});
