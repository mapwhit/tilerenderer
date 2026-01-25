import Map from '../../src/ui/map.js';
import _window from './window.js';

export function createMap(options, callback) {
  const container = window.document.createElement('div');
  Object.defineProperty(container, 'offsetWidth', { value: 200, configurable: true });
  Object.defineProperty(container, 'offsetHeight', { value: 200, configurable: true });

  const map = new Map(
    Object.assign(
      {
        container: container,
        interactive: false,
        attributionControl: false,
        trackResize: true,
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      },
      options
    )
  );

  if (callback) {
    map.on('load', () => {
      callback(null, map);
    });
  }

  return map;
}

export function createStyleSource() {
  return {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  };
}

export function createStyle() {
  return {
    version: 8,
    center: [-73.9749, 40.7736],
    zoom: 12.5,
    bearing: 29,
    pitch: 50,
    sources: {},
    layers: []
  };
}

export function initWindow(t) {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });
}

export function waitForEvent(evented, eventName, predicate) {
  return new Promise(resolve => {
    const listener = e => {
      if (predicate(e)) {
        resolve(e);
      }
    };
    evented.on(eventName, listener);
  });
}

/**
 * This allows test to wait for a certain amount of time before continuing.
 * @param milliseconds - the amount of time to wait in milliseconds
 * @returns - a promise that resolves after the specified amount of time
 */
export function sleep(milliseconds = 0) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
