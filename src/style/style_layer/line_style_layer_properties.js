// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import {
  ColorRampProperty,
  CrossFadedDataDrivenProperty,
  CrossFadedProperty,
  DataConstantProperty,
  DataDrivenProperty,
  Properties
} from '../properties.js';

const layout = new Properties({
  'line-cap': new DataConstantProperty({
    type: 'enum',
    values: ['butt', 'round', 'square'],
    default: 'butt',
    expression: { parameters: ['zoom'] }
  }),
  'line-join': new DataDrivenProperty({
    type: 'enum',
    values: ['bevel', 'round', 'miter'],
    default: 'miter',
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'line-miter-limit': new DataConstantProperty({
    type: 'number',
    default: 2,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'line-round-limit': new DataConstantProperty({
    type: 'number',
    default: 1.05,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'line-sort-key': new DataDrivenProperty({
    type: 'number',
    expression: { parameters: ['zoom', 'feature'] }
  })
});
const paint = new Properties({
  'line-opacity': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'line-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'line-translate': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'line-translate-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  }),
  'line-width': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'line-gap-width': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'line-offset': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'line-blur': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'line-dasharray': new CrossFadedProperty({
    type: 'array',
    value: 'number',
    transition: true,
    expression: { parameters: ['zoom'] }
  }),
  'line-pattern': new CrossFadedDataDrivenProperty({
    type: 'string',
    transition: true,
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'line-gradient': new ColorRampProperty({
    type: 'color',
    expression: { interpolated: true, parameters: ['line-progress'] }
  })
});

export default { paint, layout };
