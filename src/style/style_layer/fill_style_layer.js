const StyleLayer = require('../style_layer');

const FillBucket = require('../../data/bucket/fill_bucket');
const { polygonIntersectsMultiPolygon } = require('../../util/intersection_tests');
const { translateDistance, translate } = require('../query_utils');
const properties = require('./fill_style_layer_properties');

class FillStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  recalculate(parameters) {
    super.recalculate(parameters);

    const outlineColor = this._paint._values['fill-outline-color'];
    if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
      this._paint._values['fill-outline-color'] = this._paint._values['fill-color'];
    }
  }

  createBucket(parameters) {
    return new FillBucket(parameters);
  }

  queryRadius() {
    return translateDistance(this._paint.get('fill-translate'));
  }

  queryIntersectsFeature(queryGeometry, feature, featureState, geometry, zoom, transform, pixelsToTileUnits) {
    const translatedPolygon = translate(
      queryGeometry,
      this._paint.get('fill-translate'),
      this._paint.get('fill-translate-anchor'),
      transform.angle,
      pixelsToTileUnits
    );
    return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
  }

  isTileClipped() {
    return true;
  }
}

module.exports = FillStyleLayer;
