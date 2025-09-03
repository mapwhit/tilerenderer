import test from 'node:test';
import { ErrorEvent } from '@mapwhit/events';
import Map from '../../../../src/ui/map.js';
import { createMap, createStyle, initWindow } from '../../../util/util.js';

test('map events', async t => {
  initWindow(t);

  await t.test('emits load event after a style is set', (t, done) => {
    const map = new Map({ container: window.document.createElement('div') });

    map.on('load', fail);

    setTimeout(() => {
      map.off('load', fail);
      map.on('load', pass);
      map.setStyle(createStyle());
    }, 1);

    function fail() {
      t.assert.ok(false);
    }
    function pass() {
      done();
    }
  });

  await t.test('no idle event during move', async t => {
    const style = createStyle();
    const map = createMap({ style, fadeDuration: 0 });
    await map.once('idle');
    map.zoomTo(0.5, { duration: 100 });
    t.assert.ok(map.isMoving(), 'map starts moving immediately after zoomTo');
    await map.once('idle');
    t.assert.ok(!map.isMoving(), 'map stops moving before firing idle event');
  });

  await t.test('error event', async t => {
    await t.test('logs errors to console when it has NO listeners', t => {
      const map = createMap();
      const stub = t.mock.method(console, 'error', () => {});
      const error = new Error('test');
      map.fire(new ErrorEvent(error));
      t.assert.equal(stub.mock.callCount(), 1);
      t.assert.equal(stub.mock.calls[0].arguments[0], error);
    });

    await t.test('calls listeners', (t, done) => {
      const map = createMap();
      const error = new Error('test');
      map.on('error', event => {
        t.assert.equal(event.error, error);
        done();
      });
      map.fire(new ErrorEvent(error));
    });
  });
});
