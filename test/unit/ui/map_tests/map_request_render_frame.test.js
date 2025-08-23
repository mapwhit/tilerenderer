import test from 'node:test';
import Map from '../../../../src/ui/map.js';
import DOM from '../../../../src/util/dom.js';
import { createMap, initWindow } from '../../../util/util.js';
import _window from '../../../util/window.js';

test('Map._requestRenderFrame', async t => {
  initWindow(t);

  await t.test('Map._requestRenderFrame schedules a new render frame if necessary', t => {
    const map = createMap();
    t.mock.method(map, '_rerender', () => {});
    map._requestRenderFrame(() => {});
    t.assert.equal(map._rerender.mock.callCount(), 1);
    map.remove();
  });

  await t.test('Map._requestRenderFrame queues a task for the next render frame', (t, done) => {
    const map = createMap();
    const cb = t.mock.fn();
    map._requestRenderFrame(cb);
    map.once('render', () => {
      t.assert.equal(cb.mock.callCount(), 1);
      map.remove();
      done();
    });
  });

  await t.test('Map._cancelRenderFrame cancels a queued task', (t, done) => {
    const map = createMap();
    const cb = t.mock.fn();
    const id = map._requestRenderFrame(cb);
    map._cancelRenderFrame(id);
    map.once('render', () => {
      t.assert.equal(cb.mock.callCount(), 0);
      map.remove();
      done();
    });
  });
});
