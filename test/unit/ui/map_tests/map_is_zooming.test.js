import test from 'node:test';
import Map from '../../../../src/ui/map.js';
import DOM from '../../../../src/util/dom.js';
import { initWindow } from '../../../util/util.js';

function createMap() {
  return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('Map.isZooming', async t => {
  initWindow(t);

  await t.test('Map.isZooming returns false by default', t => {
    const map = createMap();
    t.assert.equal(map.isZooming(), false);
    map.remove();
  });

  await t.test('Map.isZooming returns true during a camera zoom animation', (t, done) => {
    const map = createMap();

    map.on('zoomstart', () => {
      t.assert.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
      t.assert.equal(map.isZooming(), false);
      map.remove();
      done();
    });

    map.zoomTo(5, { duration: 0 });
  });
});
