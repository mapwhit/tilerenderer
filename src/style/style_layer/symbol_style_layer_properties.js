// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { DataConstantProperty, DataDrivenProperty, Properties } from '../properties.js';

const layout = new Properties({
  'symbol-placement': new DataConstantProperty({
    type: 'enum',
    values: ['point', 'line', 'line-center'],
    default: 'point',
    expression: { parameters: ['zoom'] }
  }),
  'symbol-spacing': new DataConstantProperty({
    type: 'number',
    default: 250,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'symbol-avoid-edges': new DataConstantProperty({
    type: 'boolean',
    default: false,
    expression: { parameters: ['zoom'] }
  }),
  'symbol-z-order': new DataConstantProperty({
    type: 'enum',
    values: ['viewport-y', 'source'],
    default: 'viewport-y',
    expression: { parameters: ['zoom'] }
  }),
  'icon-allow-overlap': new DataConstantProperty({
    type: 'boolean',
    default: false,
    expression: { parameters: ['zoom'] }
  }),
  'icon-ignore-placement': new DataConstantProperty({
    type: 'boolean',
    default: false,
    expression: { parameters: ['zoom'] }
  }),
  'icon-optional': new DataConstantProperty({ type: 'boolean', default: false, expression: { parameters: ['zoom'] } }),
  'icon-rotation-alignment': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport', 'auto'],
    default: 'auto',
    expression: { parameters: ['zoom'] }
  }),
  'icon-size': new DataDrivenProperty({
    type: 'number',
    default: 1,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-text-fit': new DataConstantProperty({
    type: 'enum',
    values: ['none', 'width', 'height', 'both'],
    default: 'none',
    expression: { parameters: ['zoom'] }
  }),
  'icon-text-fit-padding': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 4,
    default: [0, 0, 0, 0],
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'icon-image': new DataDrivenProperty({
    type: 'string',
    tokens: true,
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'icon-rotate': new DataDrivenProperty({
    type: 'number',
    default: 0,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-padding': new DataConstantProperty({
    type: 'number',
    default: 2,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'icon-keep-upright': new DataConstantProperty({
    type: 'boolean',
    default: false,
    expression: { parameters: ['zoom'] }
  }),
  'icon-offset': new DataDrivenProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-anchor': new DataDrivenProperty({
    type: 'enum',
    values: ['center', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
    default: 'center',
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'icon-pitch-alignment': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport', 'auto'],
    default: 'auto',
    expression: { parameters: ['zoom'] }
  }),
  'text-pitch-alignment': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport', 'auto'],
    default: 'auto',
    expression: { parameters: ['zoom'] }
  }),
  'text-rotation-alignment': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport', 'auto'],
    default: 'auto',
    expression: { parameters: ['zoom'] }
  }),
  'text-field': new DataDrivenProperty({
    type: 'formatted',
    default: '',
    tokens: true,
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'text-font': new DataDrivenProperty({
    type: 'array',
    value: 'string',
    default: ['Open Sans Regular', 'Arial Unicode MS Regular'],
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'text-size': new DataDrivenProperty({
    type: 'number',
    default: 16,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-max-width': new DataDrivenProperty({
    type: 'number',
    default: 10,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-line-height': new DataConstantProperty({
    type: 'number',
    default: 1.2,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'text-letter-spacing': new DataDrivenProperty({
    type: 'number',
    default: 0,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-justify': new DataDrivenProperty({
    type: 'enum',
    values: ['left', 'center', 'right'],
    default: 'center',
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'text-anchor': new DataDrivenProperty({
    type: 'enum',
    values: ['center', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
    default: 'center',
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'text-max-angle': new DataConstantProperty({
    type: 'number',
    default: 45,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'text-rotate': new DataDrivenProperty({
    type: 'number',
    default: 0,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-padding': new DataConstantProperty({
    type: 'number',
    default: 2,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'text-keep-upright': new DataConstantProperty({
    type: 'boolean',
    default: true,
    expression: { parameters: ['zoom'] }
  }),
  'text-transform': new DataDrivenProperty({
    type: 'enum',
    values: ['none', 'uppercase', 'lowercase'],
    default: 'none',
    expression: { parameters: ['zoom', 'feature'] }
  }),
  'text-offset': new DataDrivenProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-allow-overlap': new DataConstantProperty({
    type: 'boolean',
    default: false,
    expression: { parameters: ['zoom'] }
  }),
  'text-ignore-placement': new DataConstantProperty({
    type: 'boolean',
    default: false,
    expression: { parameters: ['zoom'] }
  }),
  'text-optional': new DataConstantProperty({ type: 'boolean', default: false, expression: { parameters: ['zoom'] } })
});
const paint = new Properties({
  'icon-opacity': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-halo-color': new DataDrivenProperty({
    type: 'color',
    default: 'rgba(0, 0, 0, 0)',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-halo-width': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-halo-blur': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'icon-translate': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'icon-translate-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  }),
  'text-opacity': new DataDrivenProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-color': new DataDrivenProperty({
    type: 'color',
    default: '#000000',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-halo-color': new DataDrivenProperty({
    type: 'color',
    default: 'rgba(0, 0, 0, 0)',
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-halo-width': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-halo-blur': new DataDrivenProperty({
    type: 'number',
    default: 0,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'text-translate': new DataConstantProperty({
    type: 'array',
    value: 'number',
    length: 2,
    default: [0, 0],
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'text-translate-anchor': new DataConstantProperty({
    type: 'enum',
    values: ['map', 'viewport'],
    default: 'map',
    expression: { parameters: ['zoom'] }
  })
});

export default { paint, layout };
