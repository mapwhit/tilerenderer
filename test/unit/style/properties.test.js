import test from 'node:test';
import { Layout, PropertyValue } from '../../../src/style/properties.js';
import symbolProperties from '../../../src/style/style_layer/symbol_style_layer_properties.js';

test('PropertyValue', async t => {
  await t.test('set global state', t => {
    const propertyValue = new PropertyValue(symbolProperties.layout.properties['text-size'], ['global-state', 'size'], {
      size: 17
    });
    t.assert.equal(propertyValue.expression.evaluate({}), 17);
  });
});

test('Layout', async t => {
  await t.test('set global state', t => {
    const layout = new Layout(symbolProperties.layout, { textSize: 15, textTransform: 'uppercase' });
    layout.setValue('text-size', ['global-state', 'textSize']);
    layout.setValue('text-transform', ['global-state', 'textTransform']);
    const _layout = layout.possiblyEvaluate({});
    t.assert.equal(_layout.get('text-size').evaluate(), 15);
    t.assert.equal(_layout.get('text-transform').evaluate(), 'uppercase');
  });
});
