// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { CrossFadedDataDrivenProperty, DataConstantProperty, DataDrivenProperty, Properties } from '../properties.js';

const paint = new Properties({
  'fill-extrusion-opacity': new DataConstantProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'fill-extrusion-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'fill-extrusion-translate': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'fill-extrusion-translate-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  }),
  'fill-extrusion-pattern': new CrossFadedDataDrivenProperty({
    type: 'string',
    transition: true,
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'fill-extrusion-height': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'fill-extrusion-base': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'fill-extrusion-vertical-gradient': new DataConstantProperty({
    type: 'boolean',
    default: true,
    expression: { parameters: ['zoom'] }
  })
});

export default { paint };
