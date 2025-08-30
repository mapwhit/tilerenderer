import HeatmapBucket from '../../data/bucket/heatmap_bucket.js';
import renderColorRamp from '../../util/color_ramp.js';
import StyleLayer from '../style_layer.js';
import properties from './heatmap_style_layer_properties.js';

class HeatmapStyleLayer extends StyleLayer {
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

  queryRadius() {
    return 0;
  }

  queryIntersectsFeature() {
    return false;
  }

  hasOffscreenPass() {
    return this._paint.get('heatmap-opacity') !== 0 && !this.isHidden();
  }
}

export default HeatmapStyleLayer;
