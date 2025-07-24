const { sphericalToCartesian } = require('../util/util');
const { Evented } = require('@mapwhit/events');
const interpolate = require('../util/interpolate');

const lightSpec = {
  anchor: {
    type: 'enum',
    default: 'viewport',
    values: ['map', 'viewport'],
    expression: {
      parameters: ['zoom']
    }
  },
  position: {
    type: 'array',
    default: [1.15, 210, 30],
    transition: true,
    expression: {
      interpolated: true,
      parameters: ['zoom']
    }
  },
  color: {
    type: 'color',
    default: '#ffffff',
    transition: true,
    expression: {
      interpolated: true,
      parameters: ['zoom']
    }
  },
  intensity: {
    type: 'number',
    default: 0.5,
    transition: true,
    expression: {
      interpolated: true,
      parameters: ['zoom']
    }
  }
};

const { Properties, Transitionable, DataConstantProperty } = require('./properties');

class LightPositionProperty {
  constructor(specification) {
    this.specification = specification;
    this.specification['property-type'] = 'data-constant';
  }

  possiblyEvaluate(value, parameters) {
    return sphericalToCartesian(value.expression.evaluate(parameters));
  }

  interpolate(a, b, t) {
    return {
      x: interpolate(a.x, b.x, t),
      y: interpolate(a.y, b.y, t),
      z: interpolate(a.z, b.z, t)
    };
  }
}

const properties = new Properties({
  anchor: new DataConstantProperty(lightSpec.anchor),
  position: new LightPositionProperty(lightSpec.position),
  color: new DataConstantProperty(lightSpec.color),
  intensity: new DataConstantProperty(lightSpec.intensity)
});

const TRANSITION_SUFFIX = '-transition';

/*
 * Represents the light used to light extruded features.
 */
class Light extends Evented {
  constructor(lightOptions) {
    super();
    this._transitionable = new Transitionable(properties);
    this.setLight(lightOptions);
    this._transitioning = this._transitionable.untransitioned();
  }

  getLight() {
    return this._transitionable.serialize();
  }

  setLight(options) {
    for (const name in options) {
      const value = options[name];
      if (name.endsWith(TRANSITION_SUFFIX)) {
        this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
      } else {
        this._transitionable.setValue(name, value);
      }
    }
  }

  updateTransitions(parameters) {
    this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
  }

  hasTransition() {
    return this._transitioning.hasTransition();
  }

  recalculate(parameters) {
    this.properties = this._transitioning.possiblyEvaluate(parameters);
  }
}

module.exports = Light;
