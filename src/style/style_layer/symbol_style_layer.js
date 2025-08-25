import { isExpression } from '@mapwhit/style-expressions';
import assert from 'assert';
import SymbolBucket from '../../data/bucket/symbol_bucket.js';
import resolveTokens from '../../util/token.js';
import StyleLayer from '../style_layer.js';
import properties from './symbol_style_layer_properties.js';

class SymbolStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  recalculate(parameters) {
    super.recalculate(parameters);

    if (this._layout.get('icon-rotation-alignment') === 'auto') {
      if (this._layout.get('symbol-placement') !== 'point') {
        this._layout._values['icon-rotation-alignment'] = 'map';
      } else {
        this._layout._values['icon-rotation-alignment'] = 'viewport';
      }
    }

    if (this._layout.get('text-rotation-alignment') === 'auto') {
      if (this._layout.get('symbol-placement') !== 'point') {
        this._layout._values['text-rotation-alignment'] = 'map';
      } else {
        this._layout._values['text-rotation-alignment'] = 'viewport';
      }
    }

    // If unspecified, `*-pitch-alignment` inherits `*-rotation-alignment`
    if (this._layout.get('text-pitch-alignment') === 'auto') {
      this._layout._values['text-pitch-alignment'] = this._layout.get('text-rotation-alignment');
    }
    if (this._layout.get('icon-pitch-alignment') === 'auto') {
      this._layout._values['icon-pitch-alignment'] = this._layout.get('icon-rotation-alignment');
    }
  }

  getValueAndResolveTokens(name, feature) {
    const value = this._layout.get(name).evaluate(feature, {});
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

export default SymbolStyleLayer;
