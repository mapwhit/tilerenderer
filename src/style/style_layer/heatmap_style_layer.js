import HeatmapBucket from '../../data/bucket/heatmap_bucket.js';
import renderColorRamp from '../../util/color_ramp.js';
import { circleIntersection, getMaximumPaintValue } from '../query_utils.js';
import StyleLayer from '../style_layer.js';
import properties from './heatmap_style_layer_properties.js';

export default class HeatmapStyleLayer extends StyleLayer {
  createBucket(options) {
    return new HeatmapBucket(options);
  }

  constructor(layer, globalState) {
    super(layer, properties, globalState);

    // make sure color ramp texture is generated for default heatmap color too
    this._updateColorRamp();
  }

  _handleSpecialPaintPropertyUpdate(name) {
    if (name === 'heatmap-color') {
      this._updateColorRamp();
    }
  }

  _updateColorRamp() {
    const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
    this.colorRamp = renderColorRamp(expression, 'heatmapDensity');
    this.colorRampTexture = null;
  }

  resize() {
    if (this.heatmapFbo) {
      this.heatmapFbo.destroy();
      this.heatmapFbo = null;
    }
  }

  queryRadius(bucket) {
    return getMaximumPaintValue('heatmap-radius', this, bucket);
  }

  queryIntersectsFeature(
    queryGeometry,
    feature,
    featureState,
    geometry,
    zoom,
    transform,
    pixelsToTileUnits,
    pixelPosMatrix
  ) {
    return circleIntersection({
      queryGeometry,
      geometry,
      pixelPosMatrix,
      size: this._paint.get('heatmap-radius').evaluate(feature, featureState) * pixelsToTileUnits,
      transform
    });
  }

  hasOffscreenPass() {
    return this._paint.get('heatmap-opacity') !== 0 && !this.isHidden();
  }
}
