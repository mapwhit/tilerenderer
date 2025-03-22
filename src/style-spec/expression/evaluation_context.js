const { Color } = require('./values');

const geometryTypes = ['Unknown', 'Point', 'LineString', 'Polygon'];

class EvaluationContext {
  constructor() {
    this.globals = null;
    this.feature = null;
    this.featureState = null;
    this._parseColorCache = {};
  }

  id() {
    return this.feature && 'id' in this.feature ? this.feature.id : null;
  }

  geometryType() {
    return this.feature
      ? typeof this.feature.type === 'number'
        ? geometryTypes[this.feature.type]
        : this.feature.type
      : null;
  }

  properties() {
    return this.feature?.properties || {};
  }

  parseColor(input) {
    let cached = this._parseColorCache[input];
    if (!cached) {
      cached = this._parseColorCache[input] = Color.parse(input);
    }
    return cached;
  }
}

module.exports = EvaluationContext;
