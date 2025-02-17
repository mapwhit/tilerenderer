const { test } = require('../../util/mapbox-gl-js-test');
const _window = require('../../util/window');
const Map = require('../../../src/ui/map');
const simulate = require('../../util/mapbox-gl-js-test/simulate_interaction');

function createMap() {
  return new Map({
    container: window.document.createElement('div')
  });
}

test('map events', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('Map#on adds a non-delegated event listener', t => {
    const map = createMap();
    const spy = t.spy(function (e) {
      t.assert.equal(this, map);
      t.assert.equal(e.type, 'click');
    });

    map.on('click', spy);
    simulate.click(map.getCanvas());

    t.assert.ok(spy.calledOnce);
  });

  await t.test('Map#off removes a non-delegated event listener', t => {
    const map = createMap();
    const spy = t.spy();

    map.on('click', spy);
    map.off('click', spy);
    simulate.click(map.getCanvas());

    t.assert.ok(spy.notCalled);
  });

  await t.test('Map#on pointerdown can have default behavior prevented and still fire subsequent click event', t => {
    const map = createMap();

    map.on('pointerdown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);

    simulate.click(map.getCanvas());
    t.assert.equal(click.callCount, 1);

    map.remove();
  });

  await t.test(`Map#on pointerdown doesn't fire subsequent click event if pointerpos changes`, t => {
    const map = createMap();

    map.on('pointerdown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {}, { clientX: 100, clientY: 100 });
    t.assert.ok(click.notCalled);

    map.remove();
  });

  await t.test(
    'Map#on pointerdown fires subsequent click event if pointer position changes less than click tolerance',
    t => {
      const map = createMap(t, { clickTolerance: 4 });

      map.on('pointerdown', e => e.preventDefault());

      const click = t.spy();
      map.on('click', click);
      const canvas = map.getCanvas();

      simulate.drag(canvas, { clientX: 100, clientY: 100 }, { clientX: 100, clientY: 103 });
      t.assert.ok(click.called);

      map.remove();
    }
  );

  await t.test(
    'Map#on pointerdown does not fire subsequent click event if pointer position changes more than click tolerance',
    t => {
      const map = createMap(t, { clickTolerance: 4 });

      map.on('pointerdown', e => e.preventDefault());

      const click = t.spy();
      map.on('click', click);
      const canvas = map.getCanvas();

      simulate.drag(canvas, { clientX: 100, clientY: 100 }, { clientX: 100, clientY: 104 });
      t.assert.ok(click.notCalled);

      map.remove();
    }
  );
});
