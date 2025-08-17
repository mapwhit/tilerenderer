const { filterObject } = require('../util/object');

const { Evented } = require('@mapwhit/events');
const { Layout, Transitionable, PossiblyEvaluatedPropertyValue } = require('./properties');
const { supportsPropertyExpression } = require('@mapwhit/style-expressions');
const featureFilter = require('../style-spec/feature_filter');

const TRANSITION_SUFFIX = '-transition';

/**
 * Representing a style layer in the map.
 * Properties:
 * `this.paint` - paint properties of the layer as defined in the map style
 * `this._paint` - internal representation of paint properties necessary to calculate expressions
 */
class StyleLayer extends Evented {
  constructor(layer, properties) {
    super();

    this.id = layer.id;
    this.metadata = layer.metadata;
    this.type = layer.type;
    this.minzoom = layer.minzoom;
    this.maxzoom = layer.maxzoom;
    this.visibility = 'visible';
    this.paint = {};
    this.layout = {};

    if (layer.type !== 'background') {
      this.source = layer.source;
      this['source-layer'] = this.sourceLayer = layer['source-layer'];
      this.filter = layer.filter;
      this._featureFilter = featureFilter(layer.filter);
    }

    this._featureFilter ??= featureFilter.addGlobalStateRefs(() => true);

    if (properties.layout) {
      this._unevaluatedLayout = new Layout(properties.layout);
    }

    this._transitionablePaint = new Transitionable(properties.paint);

    for (const property in layer.paint) {
      this.setPaintProperty(property, layer.paint[property]);
    }
    for (const property in layer.layout) {
      this.setLayoutProperty(property, layer.layout[property]);
    }

    this._transitioningPaint = this._transitionablePaint.untransitioned();
  }

  setFilter(filter) {
    this.filter = filter;
    this._featureFilter = featureFilter(filter);
  }

  getCrossfadeParameters() {
    return this._crossfadeParameters;
  }

  getLayoutProperty(name) {
    if (name === 'visibility') {
      return this.visibility;
    }

    return this._unevaluatedLayout.getValue(name);
  }

  /**
   * Get list of global state references that are used within layout or filter properties.
   * This is used to determine if layer source need to be reloaded when global state property changes.
   *
   */
  getLayoutAffectingGlobalStateRefs() {
    const globalStateRefs = new Set();

    if (this._unevaluatedLayout) {
      for (const propertyName in this._unevaluatedLayout._values) {
        const value = this._unevaluatedLayout._values[propertyName];

        for (const globalStateRef of value.getGlobalStateRefs()) {
          globalStateRefs.add(globalStateRef);
        }
      }
    }

    for (const globalStateRef of this._featureFilter.getGlobalStateRefs()) {
      globalStateRefs.add(globalStateRef);
    }

    return globalStateRefs;
  }

  /**
   * Get list of global state references that are used within paint properties.
   * This is used to determine if layer needs to be repainted when global state property changes.
   *
   */
  getPaintAffectingGlobalStateRefs() {
    const globalStateRefs = new Map();

    if (this._transitionablePaint) {
      for (const propertyName in this._transitionablePaint._values) {
        const value = this._transitionablePaint._values[propertyName].value;

        for (const globalStateRef of value.getGlobalStateRefs()) {
          const properties = globalStateRefs.get(globalStateRef) ?? [];
          properties.push({ name: propertyName, value: value.value });
          globalStateRefs.set(globalStateRef, properties);
        }
      }
    }

    return globalStateRefs;
  }

  setLayoutProperty(name, value) {
    this.layout[name] = value;
    if (name === 'visibility') {
      this.visibility = value === 'none' ? value : 'visible';
      return;
    }

    this._unevaluatedLayout.setValue(name, value);
  }

  getPaintProperty(name) {
    if (name.endsWith(TRANSITION_SUFFIX)) {
      return this._transitionablePaint.getTransition(name.slice(0, -TRANSITION_SUFFIX.length));
    }
    return this._transitionablePaint.getValue(name);
  }

  setPaintProperty(name, value) {
    this.paint[name] = value;
    if (name.endsWith(TRANSITION_SUFFIX)) {
      this._transitionablePaint.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value || undefined);
      return false;
    }
    // if a cross-faded value is changed, we need to make sure the new icons get added to each tile's iconAtlas
    // so a call to _updateLayer is necessary, and we return true from this function so it gets called in
    // Style#setPaintProperty
    const prop = this._transitionablePaint._values[name];
    const newCrossFadedValue =
      prop.property.specification['property-type'] === 'cross-faded-data-driven' && !prop.value.value && value;
    const wasDataDriven = this._transitionablePaint._values[name].value.isDataDriven();
    this._transitionablePaint.setValue(name, value);
    const isDataDriven = this._transitionablePaint._values[name].value.isDataDriven();
    this._handleSpecialPaintPropertyUpdate(name);
    if (isDataDriven !== wasDataDriven || (wasDataDriven && isDataDriven)) {
      // reset transitioning in progress
      this._untransitioned(name);
    }
    return isDataDriven || wasDataDriven || newCrossFadedValue;
  }

  _untransitioned(name) {
    if (this._transitioningPaint) {
      this._transitioningPaint._values[name] = this._transitionablePaint._values[name].untransitioned();
    }
  }

  _handleSpecialPaintPropertyUpdate() {
    // No-op; can be overridden by derived classes.
  }

  isHidden(zoom) {
    if (this.minzoom && zoom < this.minzoom) return true;
    if (this.maxzoom && zoom >= this.maxzoom) return true;
    return this.visibility === 'none';
  }

  updateTransitions(parameters) {
    this._transitioningPaint = this._transitionablePaint.transitioned(parameters, this._transitioningPaint);
  }

  hasTransition() {
    return this._transitioningPaint.hasTransition();
  }

  recalculate(parameters) {
    if (parameters.getCrossfadeParameters) {
      this._crossfadeParameters = parameters.getCrossfadeParameters();
    }
    if (this._unevaluatedLayout) {
      this._layout = this._unevaluatedLayout.possiblyEvaluate(parameters);
    }

    this._paint = this._transitioningPaint.possiblyEvaluate(parameters);
  }

  serialize() {
    const output = {
      id: this.id,
      type: this.type,
      source: this.source,
      'source-layer': this.sourceLayer,
      metadata: this.metadata,
      minzoom: this.minzoom,
      maxzoom: this.maxzoom,
      filter: this.filter,
      layout: this._unevaluatedLayout?.serialize(),
      paint: this._transitionablePaint?.serialize()
    };

    if (this.visibility === 'none') {
      output.layout = output.layout || {};
      output.layout.visibility = 'none';
    }

    return filterObject(output, (value, key) => {
      return (
        value !== undefined &&
        !(key === 'layout' && !Object.keys(value).length) &&
        !(key === 'paint' && !Object.keys(value).length)
      );
    });
  }

  is3D() {
    return false;
  }

  isTileClipped() {
    return false;
  }

  hasOffscreenPass() {
    return false;
  }

  resize() {
    // noop
  }

  isStateDependent() {
    for (const property in this._paint._values) {
      const value = this._paint.get(property);
      if (
        !(value instanceof PossiblyEvaluatedPropertyValue) ||
        !supportsPropertyExpression(value.property.specification)
      ) {
        continue;
      }

      if ((value.value.kind === 'source' || value.value.kind === 'composite') && value.value.isStateDependent) {
        return true;
      }
    }
    return false;
  }

  get layoutObj() {
    if (!this._unevaluatedLayout) {
      return undefined;
    }
    const { _values } = this._unevaluatedLayout;
    const result = {};
    for (const property of Object.keys(_values)) {
      const value = _values[property].value;
      if (value !== undefined) {
        result[property] = value;
      }
    }
    return result;
  }
}

module.exports = StyleLayer;
