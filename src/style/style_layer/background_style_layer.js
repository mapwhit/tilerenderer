const StyleLayer = require('../style_layer');

const properties = require('./background_style_layer_properties');

class BackgroundStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }
}

module.exports = BackgroundStyleLayer;
