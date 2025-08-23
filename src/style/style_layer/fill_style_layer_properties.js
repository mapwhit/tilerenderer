// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { CrossFadedDataDrivenProperty, DataConstantProperty, DataDrivenProperty, Properties } from '../properties.js';

const paint = new Properties({
  'fill-antialias': new DataConstantProperty({ type: 'boolean', default: true, expression: { parameters: ['zoom'] } }),
  'fill-opacity': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'fill-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'fill-outline-color': new DataDrivenProperty({
    type: 'color',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'fill-translate': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'fill-translate-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  }),
  'fill-pattern': new CrossFadedDataDrivenProperty({
    type: 'string',
    transition: true,
    expression: { parameters: ['zoom', 'feature'] }
  })
});

export default { paint };
