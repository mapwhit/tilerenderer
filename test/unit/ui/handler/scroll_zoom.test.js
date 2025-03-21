const { test } = require('../../../util/mapbox-gl-js-test');
const _window = require('../../../util/window');
const browser = require('../../../../src/util/browser');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('../../../util/mapbox-gl-js-test/simulate_interaction');
const sinon = require('sinon');

function createMap(options) {
  return new Map(
    Object.assign(
      {
        container: DOM.create('div', '', window.document.body),
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      },
      options
    )
  );
}

test('ScrollZoomHandler', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  const browserNow = t.stub(browser, 'now');
  let now = 1555555555555;
  browserNow.callsFake(() => now);

  await t.test('Zooms for single mouse wheel tick', t => {
    const map = createMap();
    map._renderTaskQueue.run();

    // simulate a single 'wheel' event
    const startZoom = map.getZoom();

    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -simulate.magicWheelZoomDelta });
    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();

    t.assert.equalWithPrecision(map.getZoom() - startZoom, 0.0285, 0.001);

    map.remove();
  });

  await t.test('Zooms for single mouse wheel tick with non-magical deltaY', t => {
    const map = createMap();
    map._renderTaskQueue.run();

    // Simulate a single 'wheel' event without the magical deltaY value.
    // This requires the handler to briefly wait to see if a subsequent
    // event is coming in order to guess trackpad vs. mouse wheel
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -20 });
    map.on('zoomstart', () => {
      map.remove();
    });
  });

  await t.test('Zooms for multiple mouse wheel ticks', t => {
    const map = createMap();

    map._renderTaskQueue.run();
    const startZoom = map.getZoom();

    const events = [
      [2, { type: 'wheel', deltaY: -simulate.magicWheelZoomDelta }],
      [7, { type: 'wheel', deltaY: -41 }],
      [30, { type: 'wheel', deltaY: -169 }],
      [1, { type: 'wheel', deltaY: -801 }],
      [5, { type: 'wheel', deltaY: -326 }],
      [20, { type: 'wheel', deltaY: -345 }],
      [22, { type: 'wheel', deltaY: -376 }]
    ];

    const end = now + 500;
    let lastWheelEvent = now;

    // simulate the above sequence of wheel events, with render frames
    // interspersed every 20ms
    while (now++ < end) {
      if (events.length && lastWheelEvent + events[0][0] === now) {
        const [, event] = events.shift();
        simulate.wheel(map.getCanvas(), event);
        lastWheelEvent = now;
      }
      if (now % 20 === 0) {
        map._renderTaskQueue.run();
      }
    }

    t.assert.equalWithPrecision(map.getZoom() - startZoom, 1.944, 0.001);

    map.remove();
  });

  await t.test('Gracefully ignores wheel events with deltaY: 0', t => {
    const map = createMap();
    map._renderTaskQueue.run();

    const startZoom = map.getZoom();
    // simulate  shift+'wheel' events
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -0, shiftKey: true });
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -0, shiftKey: true });
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -0, shiftKey: true });
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -0, shiftKey: true });
    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();

    t.assert.equal(map.getZoom() - startZoom, 0.0);
  });

  test('Gracefully handle wheel events that cancel each other out before the first scroll frame', t => {
    // See also https://github.com/mapbox/mapbox-gl-js/issues/6782
    const map = createMap();
    map._renderTaskQueue.run();

    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -1 });
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -1 });
    now += 1;
    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: 2 });

    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();
  });

  test('does not zoom if preventDefault is called on the wheel event', t => {
    const map = createMap();

    map.on('wheel', e => e.preventDefault());

    simulate.wheel(map.getCanvas(), { type: 'wheel', deltaY: -simulate.magicWheelZoomDelta });
    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();

    t.assert.equal(map.getZoom(), 0);

    map.remove();
  });

  await t.test('emits one movestart event and one moveend event while zooming', t => {
    const clock = sinon.useFakeTimers(now);
    const map = createMap(t);

    let startCount = 0;
    map.on('movestart', () => {
      startCount += 1;
    });

    let endCount = 0;
    map.on('moveend', () => {
      endCount += 1;
    });

    const events = [
      [2, { type: 'trackpad', deltaY: -1 }],
      [7, { type: 'trackpad', deltaY: -2 }],
      [30, { type: 'wheel', deltaY: -5 }]
    ];

    const end = now + 50;
    let lastWheelEvent = now;

    while (now++ < end) {
      if (events.length && lastWheelEvent + events[0][0] === now) {
        const [, event] = events.shift();
        simulate.wheel(map.getCanvas(), event);
        lastWheelEvent = now;
      }
      if (now % 20 === 0) {
        map._renderTaskQueue.run();
      }
    }

    clock.tick(200);

    t.assert.equal(startCount, 1);
    t.assert.equal(endCount, 1);

    clock.restore();
  });

  await t.test('emits one zoomstart event and one zoomend event while zooming', t => {
    const clock = sinon.useFakeTimers(now);
    const map = createMap(t);

    let startCount = 0;
    map.on('zoomstart', () => {
      startCount += 1;
    });

    let endCount = 0;
    map.on('zoomend', () => {
      endCount += 1;
    });

    const events = [
      [2, { type: 'trackpad', deltaY: -1 }],
      [7, { type: 'trackpad', deltaY: -2 }],
      [30, { type: 'wheel', deltaY: -5 }]
    ];

    const end = now + 50;
    let lastWheelEvent = now;

    while (now++ < end) {
      if (events.length && lastWheelEvent + events[0][0] === now) {
        const [, event] = events.shift();
        simulate.wheel(map.getCanvas(), event);
        lastWheelEvent = now;
      }
      if (now % 20 === 0) {
        map._renderTaskQueue.run();
      }
    }

    clock.tick(200);

    t.assert.equal(startCount, 1);
    t.assert.equal(endCount, 1);

    clock.restore();
  });
});
