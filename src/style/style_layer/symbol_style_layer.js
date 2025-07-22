const StyleLayer = require('../style_layer');

const SymbolBucket = require('../../data/bucket/symbol_bucket');
const resolveTokens = require('../../util/token');
const { isExpression } = require('@mapwhit/style-expressions');
const assert = require('assert');
const properties = require('./symbol_style_layer_properties');

class SymbolStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  recalculate(parameters) {
    super.recalculate(parameters);

    if (this.layout.get('icon-rotation-alignment') === 'auto') {
      if (this.layout.get('symbol-placement') !== 'point') {
        this.layout._values['icon-rotation-alignment'] = 'map';
      } else {
        this.layout._values['icon-rotation-alignment'] = 'viewport';
      }
    }

    if (this.layout.get('text-rotation-alignment') === 'auto') {
      if (this.layout.get('symbol-placement') !== 'point') {
        this.layout._values['text-rotation-alignment'] = 'map';
      } else {
        this.layout._values['text-rotation-alignment'] = 'viewport';
      }
    }

    // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
    if (this.layout.get('text-pitch-alignment') === 'auto') {
      this.layout._values['text-pitch-alignment'] = this.layout.get('text-rotation-alignment');
    }
    if (this.layout.get('icon-pitch-alignment') === 'auto') {
      this.layout._values['icon-pitch-alignment'] = this.layout.get('icon-rotation-alignment');
    }
  }

  getValueAndResolveTokens(name, feature) {
    const value = this.layout.get(name).evaluate(feature, {});
    const unevaluated = this._unevaluatedLayout._values[name];
    if (!unevaluated.isDataDriven() && !isExpression(unevaluated.value)) {
      return resolveTokens(feature.properties, value);
    }

    return value;
  }

  createBucket(parameters) {
    return new SymbolBucket(parameters);
  }

  queryRadius() {
    return 0;
  }

  queryIntersectsFeature() {
    assert(false); // Should take a different path in FeatureIndex
    return false;
  }
}

module.exports = SymbolStyleLayer;
