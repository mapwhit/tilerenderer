// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { DataConstantProperty, DataDrivenProperty, Properties } from '../properties.js';

const paint = new Properties({
  'circle-radius': new DataDrivenProperty({
    type: 'number',
    default: 5,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'circle-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'circle-blur': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'circle-opacity': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'circle-translate': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'circle-translate-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  }),
  'circle-pitch-scale': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  }),
  'circle-pitch-alignment': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'viewport',
    expression: { parameters: ['zoom'] }
  }),
  'circle-stroke-width': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'circle-stroke-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'circle-stroke-opacity': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  })
});

export default { paint };
