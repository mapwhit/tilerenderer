import { backgroundPatternUniforms, backgroundUniforms } from './background_program.js';
import { circleUniforms } from './circle_program.js';
import { clippingMaskUniforms } from './clipping_mask_program.js';
import { collisionUniforms } from './collision_program.js';
import { debugUniforms } from './debug_program.js';
import { fillExtrusionPatternUniforms, fillExtrusionUniforms } from './fill_extrusion_program.js';
import { fillOutlinePatternUniforms, fillOutlineUniforms, fillPatternUniforms, fillUniforms } from './fill_program.js';
import { heatmapTextureUniforms, heatmapUniforms } from './heatmap_program.js';
import { hillshadePrepareUniforms, hillshadeUniforms } from './hillshade_program.js';
import { lineGradientUniforms, linePatternUniforms, lineSDFUniforms, lineUniforms } from './line_program.js';
import { rasterUniforms } from './raster_program.js';
import { symbolIconUniforms, symbolSDFUniforms } from './symbol_program.js';

export const programUniforms = {
  fillExtrusion: fillExtrusionUniforms,
  fillExtrusionPattern: fillExtrusionPatternUniforms,
  fill: fillUniforms,
  fillPattern: fillPatternUniforms,
  fillOutline: fillOutlineUniforms,
  fillOutlinePattern: fillOutlinePatternUniforms,
  circle: circleUniforms,
  collisionBox: collisionUniforms,
  collisionCircle: collisionUniforms,
  debug: debugUniforms,
  clippingMask: clippingMaskUniforms,
  heatmap: heatmapUniforms,
  heatmapTexture: heatmapTextureUniforms,
  hillshade: hillshadeUniforms,
  hillshadePrepare: hillshadePrepareUniforms,
  line: lineUniforms,
  lineGradient: lineGradientUniforms,
  linePattern: linePatternUniforms,
  lineSDF: lineSDFUniforms,
  raster: rasterUniforms,
  symbolIcon: symbolIconUniforms,
  symbolSDF: symbolSDFUniforms,
  background: backgroundUniforms,
  backgroundPattern: backgroundPatternUniforms
};
