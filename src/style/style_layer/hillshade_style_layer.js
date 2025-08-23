import StyleLayer from '../style_layer.js';
import properties from './hillshade_style_layer_properties.js';

class HillshadeStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  hasOffscreenPass() {
    return this._paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
  }
}

export default HillshadeStyleLayer;
