const { test } = require('../../util/mapbox-gl-js-test');
const Light = require('../../../src/style/light');
const { Color } = require('@mapwhit/style-expressions');
const { sphericalToCartesian } = require('../../../src/util/util');

const spec = {
  anchor: {
    default: 'viewport'
  },
  position: {
    default: [1.15, 210, 30]
  },
  color: {
    default: '#ffffff'
  },
  intensity: {
    default: 0.5
  }
};

test('Light with defaults', t => {
  const light = new Light({});
  light.recalculate({ zoom: 0, zoomHistory: {} });

  t.assert.deepEqual(light.properties.get('anchor'), spec.anchor.default);
  t.assert.deepEqual(light.properties.get('position'), sphericalToCartesian(spec.position.default));
  t.assert.deepEqual(light.properties.get('intensity'), spec.intensity.default);
  t.assert.deepEqual(light.properties.get('color'), Color.parse(spec.color.default));
});

test('Light with options', t => {
  const light = new Light({
    anchor: 'map',
    position: [2, 30, 30],
    intensity: 1
  });
  light.recalculate({ zoom: 0, zoomHistory: {} });

  t.assert.deepEqual(light.properties.get('anchor'), 'map');
  t.assert.deepEqual(light.properties.get('position'), sphericalToCartesian([2, 30, 30]));
  t.assert.deepEqual(light.properties.get('intensity'), 1);
  t.assert.deepEqual(light.properties.get('color'), Color.parse(spec.color.default));
});

test('Light with stops function', t => {
  const light = new Light({
    intensity: {
      stops: [
        [16, 0.2],
        [17, 0.8]
      ]
    }
  });
  light.recalculate({ zoom: 16.5, zoomHistory: {} });

  t.assert.deepEqual(light.properties.get('intensity'), 0.5);
});

test('Light#getLight', t => {
  const defaults = {};
  for (const key in spec) {
    defaults[key] = spec[key].default;
  }

  t.assert.deepEqual(new Light(defaults).getLight(), defaults);
});

test('Light#setLight', t => {
  const light = new Light({});
  light.setLight({ color: 'red', 'color-transition': { duration: 3000 } });
  light.updateTransitions({ transition: true }, {});
  light.recalculate({ zoom: 16, zoomHistory: {}, now: 1500 });

  t.assert.deepEqual(light.properties.get('color'), new Color(1, 0.5, 0.5, 1));
});
