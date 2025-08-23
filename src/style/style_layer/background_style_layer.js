import StyleLayer from '../style_layer.js';
import properties from './background_style_layer_properties.js';

class BackgroundStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }
}

export default BackgroundStyleLayer;
