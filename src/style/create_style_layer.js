const circle = require('./style_layer/circle_style_layer');
const heatmap = require('./style_layer/heatmap_style_layer');
const hillshade = require('./style_layer/hillshade_style_layer');
const fill = require('./style_layer/fill_style_layer');
const { FillExtrusionStyleLayer: fillExtrusion } = require('./style_layer/fill_extrusion_style_layer');
const line = require('./style_layer/line_style_layer');
const symbol = require('./style_layer/symbol_style_layer');
const background = require('./style_layer/background_style_layer');
const raster = require('./style_layer/raster_style_layer');

const subclasses = {
  circle,
  heatmap,
  hillshade,
  fill,
  'fill-extrusion': fillExtrusion,
  line,
  symbol,
  background,
  raster
};

module.exports = function createStyleLayer(layer) {
  return new subclasses[layer.type](layer);
};
