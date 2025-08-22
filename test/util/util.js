const _window = require('./window');
const Map = require('../../src/ui/map');

module.exports = { createMap, createStyleSource, createStyle, initWindow };

function createMap(options, callback) {
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

  if (callback)
    map.on('load', () => {
      callback(null, map);
    });

  return map;
}

function createStyleSource() {
  return {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  };
}

function createStyle() {
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

function initWindow(t) {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });
}
