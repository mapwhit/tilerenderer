// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { DataConstantProperty, Properties } from '../properties.js';

const paint = new Properties({
  'hillshade-illumination-direction': new DataConstantProperty({
    type: 'number',
    default: 335,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'hillshade-illumination-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'viewport',
    expression: { parameters: ['zoom'] }
  }),
  'hillshade-exaggeration': new DataConstantProperty({
    type: 'number',
    default: 0.5,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'hillshade-shadow-color': new DataConstantProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'hillshade-highlight-color': new DataConstantProperty({
    type: 'color',
    default: '#FFFFFF',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'hillshade-accent-color': new DataConstantProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  })
});

export default { paint };
