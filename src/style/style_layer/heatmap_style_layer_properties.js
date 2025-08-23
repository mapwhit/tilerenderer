// This file is generated. Edit layer-properties.js.ejs, then run `make generate-style-code`.

import { ColorRampProperty, DataConstantProperty, DataDrivenProperty, Properties } from '../properties.js';

const paint = new Properties({
  'heatmap-radius': new DataDrivenProperty({
    type: 'number',
    default: 30,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'heatmap-weight': new DataDrivenProperty({
    type: 'number',
    default: 1,
    expression: { interpolated: true, parameters: ['zoom', 'feature'] }
  }),
  'heatmap-intensity': new DataConstantProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  }),
  'heatmap-color': new ColorRampProperty({
    type: 'color',
    default: [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(0, 0, 255, 0)',
      0.1,
      'royalblue',
      0.3,
      'cyan',
      0.5,
      'lime',
      0.7,
      'yellow',
      1,
      'red'
    ],
    expression: { interpolated: true, parameters: ['heatmap-density'] }
  }),
  'heatmap-opacity': new DataConstantProperty({
    type: 'number',
    default: 1,
    transition: true,
    expression: { interpolated: true, parameters: ['zoom'] }
  })
});

export default { paint };
