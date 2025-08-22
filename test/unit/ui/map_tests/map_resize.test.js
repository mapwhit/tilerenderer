const test = require('node:test');
const { createMap, initWindow } = require('../../../util/util');

test('map resize', async t => {
  initWindow(t);

  await t.test('sets width and height from container offsets', (t, done) => {
    const map = createMap();
    const container = map.getContainer();

    Object.defineProperty(container, 'offsetWidth', { value: 250 });
    Object.defineProperty(container, 'offsetHeight', { value: 250 });
    map.resize();

    t.assert.equal(map.transform.width, 250);
    t.assert.equal(map.transform.height, 250);

    done();
  });

  await t.test('fires movestart, move, resize, and moveend events', async t => {
    const map = createMap();
    const events = [];

    ['movestart', 'move', 'resize', 'moveend'].forEach(event => {
      map.on(event, e => {
        events.push(e.type);
      });
    });

    map.resize();
    t.assert.deepEqual(events, ['movestart', 'move', 'resize', 'moveend']);
  });

  await t.test('listen to window resize event', (t, done) => {
    window.addEventListener = function (type) {
      if (type === 'resize') {
        //restore empty function not to mess with other tests
        window.addEventListener = function () {};

        done();
      }
    };

    createMap();
  });

  await t.test('do not resize if trackResize is false', t => {
    const map = createMap({ trackResize: false });

    t.mock.method(map, 'stop');
    t.mock.method(map, '_update');
    t.mock.method(map, 'resize');

    map._onWindowResize();

    t.assert.equal(map.stop.mock.callCount(), 0);
    t.assert.equal(map._update.mock.callCount(), 0);
    t.assert.equal(map.resize.mock.callCount(), 0);
  });

  await t.test('do resize if trackResize is true (default)', t => {
    const map = createMap();

    t.mock.method(map, 'stop');
    t.mock.method(map, '_update');
    t.mock.method(map, 'resize');

    map._onWindowResize();

    t.assert.ok(map.stop.mock.callCount() > 0);
    t.assert.ok(map._update.mock.callCount() > 0);
    t.assert.ok(map.resize.mock.callCount() > 0);
  });
});
