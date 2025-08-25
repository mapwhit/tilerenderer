// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { DataConstantProperty, Properties } from '../properties.js';

const paint = new Properties({
  'raster-opacity': new DataConstantProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'raster-hue-rotate': new DataConstantProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'raster-brightness-min': new DataConstantProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'raster-brightness-max': new DataConstantProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'raster-saturation': new DataConstantProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'raster-contrast': new DataConstantProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'raster-resampling': new DataConstantProperty({
    type: 'enum',
    values: ['linear', 'nearest'],
    default: 'linear',
    expression: { parameters: ['zoom'] }
  }),
  'raster-fade-duration': new DataConstantProperty({
    type: 'number',
    default: 300,
    expression: { interpolated: true, parameters: ['zoom'] }
  })
});

export default { paint };
