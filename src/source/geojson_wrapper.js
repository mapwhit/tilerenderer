const Point = require('@mapbox/point-geometry');
const { VectorTileFeature } = require('@mapbox/vector-tile');
const EXTENT = require('../data/extent');

const { toGeoJSON } = VectorTileFeature.prototype;

// The feature type used by geojson-vt and supercluster. Should be extracted to
// global type and used in module definitions for those two modules.

class FeatureWrapper {
  constructor(feature) {
    this._feature = feature;

    // If the feature has a top-level `id` property, copy it over, but only
    // if it can be coerced to an integer, because this wrapper is used for
    // serializing geojson feature data into vector tile PBF data, and the
    // vector tile spec only supports integer values for feature ids --
    // allowing non-integer values here results in a non-compliant PBF
    // that causes an exception when it is parsed with vector-tile-js
    if ('id' in feature && !isNaN(feature.id)) {
      this.id = Number.parseInt(feature.id, 10);
    }
  }

  get type() {
    return this._feature.type;
  }

  get properties() {
    return this._feature.tags;
  }

  get extent() {
    return EXTENT;
  }

  loadGeometry() {
    return this.type === 1
      ? this._feature.geometry.map(p => [makePoint(p)])
      : this._feature.geometry.map(ring => ring.map(makePoint));
  }

  toGeoJSON(x, y, z) {
    return toGeoJSON.call(this, x, y, z);
  }
}

class GeoJSONWrapper {
  constructor(features) {
    this.layers = { _geojsonTileLayer: this };
    this._features = features;
  }

  get extent() {
    return EXTENT;
  }

  get length() {
    return this._features.length;
  }

  get name() {
    return '_geojsonTileLayer';
  }

  feature(i) {
    return new FeatureWrapper(this._features[i]);
  }
}

module.exports = GeoJSONWrapper;

function makePoint(arr) {
  return new Point(arr[0], arr[1]);
}
