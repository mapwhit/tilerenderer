import StyleLayer from '../style_layer.js';
import properties from './raster_style_layer_properties.js';

class RasterStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }
}

export default RasterStyleLayer;
