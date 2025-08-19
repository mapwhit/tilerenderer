const StyleLayer = require('../style_layer');

const properties = require('./hillshade_style_layer_properties');

class HillshadeStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  hasOffscreenPass() {
    return this._paint.get('hillshade-exaggeration') !== 0 && this.visibility !== 'none';
  }
}

module.exports = HillshadeStyleLayer;
