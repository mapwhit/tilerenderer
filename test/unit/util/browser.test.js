import test from 'node:test';
import browser from '../../../src/util/browser.js';

test('browser', async t => {
  await t.test('frame', (t, done) => {
    const id = browser.frame(() => {
      t.assert.ok(id, 'returns id');
      done();
    });
  });

  await t.test('now', t => {
    t.assert.equal(typeof browser.now(), 'number');
  });

  await t.test('cancelFrame', t => {
    const id = browser.frame(() => {
      t.assert.fail();
    });
    browser.cancelFrame(id);
  });

  await t.test('devicePixelRatio', t => {
    t.assert.equal(typeof browser.devicePixelRatio, 'number');
  });

  await t.test('hardwareConcurrency', t => {
    t.assert.equal(typeof browser.hardwareConcurrency, 'number');
  });
});
