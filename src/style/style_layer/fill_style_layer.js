import { polygonIntersectsMultiPolygon } from '@mapwhit/geometry';
import FillBucket from '../../data/bucket/fill_bucket.js';
import { translate, translateDistance } from '../query_utils.js';
import StyleLayer from '../style_layer.js';
import properties from './fill_style_layer_properties.js';

class FillStyleLayer extends StyleLayer {
  constructor(layer, globalState) {
    super(layer, properties, globalState);
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

export default FillStyleLayer;
