import background from './style_layer/background_style_layer.js';
import circle from './style_layer/circle_style_layer.js';
import { FillExtrusionStyleLayer as fillExtrusion } from './style_layer/fill_extrusion_style_layer.js';
import fill from './style_layer/fill_style_layer.js';
import heatmap from './style_layer/heatmap_style_layer.js';
import hillshade from './style_layer/hillshade_style_layer.js';
import line from './style_layer/line_style_layer.js';
import raster from './style_layer/raster_style_layer.js';
import symbol from './style_layer/symbol_style_layer.js';

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

export default function createStyleLayer(layer, globalState) {
  return new subclasses[layer.type](layer, globalState);
}
