import test from 'node:test';
import { createMap, initWindow } from '../../../util/util.js';

test('map controls', async t => {
  initWindow(t);

  await t.test('addControl', (t, done) => {
    const map = createMap();
    const control = {
      onAdd: function (_) {
        t.assert.equal(map, _, 'addTo() called with map');
        done();
        return window.document.createElement('div');
      }
    };
    map.addControl(control);
  });

  await t.test('removeControl', (t, done) => {
    const map = createMap();
    const control = {
      onAdd: function () {
        return window.document.createElement('div');
      },
      onRemove: function (_) {
        t.assert.equal(map, _, 'onRemove() called with map');
        done();
      }
    };
    map.addControl(control);
    map.removeControl(control);
  });
});
