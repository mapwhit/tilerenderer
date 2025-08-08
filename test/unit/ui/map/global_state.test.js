const test = require('node:test');
const createStyleLayer = require('../../../../src/style/create_style_layer');

test('StyleLayer.getLayoutAffectingGlobalStateRefs', async t => {
  await t.test('returns empty Set when no global state references', () => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#000000'
      }
    });

    t.assert.deepEqual(layer.getLayoutAffectingGlobalStateRefs(), new Set());
  });

  await t.test('returns global-state references from filter properties', () => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      source: 'source',
      //@ts-ignore
      filter: ['==', ['global-state', 'showSymbol'], true]
    });

    t.assert.deepEqual(layer.getLayoutAffectingGlobalStateRefs(), new Set(['showSymbol']));
  });

  await t.test('returns global-state references from layout properties', () => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      source: 'source',
      layout: {
        'text-field': '{text}',
        //@ts-ignore
        'text-size': ['global-state', 'textSize'],
        //@ts-ignore
        'text-transform': ['global-state', 'textTransform']
      }
    });

    t.assert.deepEqual(layer.getLayoutAffectingGlobalStateRefs(), new Set(['textSize', 'textTransform']));
  });
});
