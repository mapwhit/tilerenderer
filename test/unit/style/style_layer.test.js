import test from 'node:test';
import { Color } from '@mapwhit/style-expressions';
import createStyleLayer from '../../../src/style/create_style_layer.js';
import FillStyleLayer from '../../../src/style/style_layer/fill_style_layer.js';

test('StyleLayer', async t => {
  await t.test('instantiates the correct subclass', t => {
    const layer = createStyleLayer({ type: 'fill' });

    t.assert.ok(layer instanceof FillStyleLayer);
  });
});

test('StyleLayer.setPaintProperty', async t => {
  await t.test('sets new property value', t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background'
    });

    layer.setPaintProperty('background-color', 'blue');

    t.assert.deepEqual(layer.getPaintProperty('background-color'), 'blue');
  });

  await t.test('updates property value', t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'red'
      }
    });

    layer.setPaintProperty('background-color', 'blue');

    t.assert.deepEqual(layer.getPaintProperty('background-color'), 'blue');
  });

  await t.test('unsets value', t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'red',
        'background-opacity': 1
      }
    });

    layer.setPaintProperty('background-color', null);
    layer.updateTransitions({});
    layer.recalculate({ zoom: 0, zoomHistory: {} });

    t.assert.deepEqual(layer._paint.get('background-color'), new Color(0, 0, 0, 1));
    t.assert.equal(layer.getPaintProperty('background-color'), undefined);
    t.assert.equal(layer._paint.get('background-opacity'), 1);
    t.assert.equal(layer.getPaintProperty('background-opacity'), 1);
  });

  await t.test('preserves existing transition', t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'red',
        'background-color-transition': {
          duration: 600
        }
      }
    });

    layer.setPaintProperty('background-color', 'blue');

    t.assert.deepEqual(layer.getPaintProperty('background-color-transition'), { duration: 600 });
  });

  await t.test('sets transition', t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'red'
      }
    });

    layer.setPaintProperty('background-color-transition', { duration: 400 });

    t.assert.deepEqual(layer.getPaintProperty('background-color-transition'), { duration: 400 });
  });

  await t.test('can unset fill-outline-color #2886', t => {
    const layer = createStyleLayer({
      id: 'building',
      type: 'fill',
      source: 'streets',
      paint: {
        'fill-color': '#00f'
      }
    });

    layer.setPaintProperty('fill-outline-color', '#f00');
    layer.updateTransitions({});
    layer.recalculate({ zoom: 0, zoomHistory: {} });
    t.assert.deepEqual(layer._paint.get('fill-outline-color').value, {
      kind: 'constant',
      value: new Color(1, 0, 0, 1)
    });

    layer.setPaintProperty('fill-outline-color', undefined);
    layer.updateTransitions({});
    layer.recalculate({ zoom: 0, zoomHistory: {} });
    t.assert.deepEqual(layer._paint.get('fill-outline-color').value, {
      kind: 'constant',
      value: new Color(0, 0, 1, 1)
    });
  });

  await t.test('can transition fill-outline-color from undefined to a value #3657', t => {
    t.assert.doesNotThrow(() => {
      const layer = createStyleLayer({
        id: 'building',
        type: 'fill',
        source: 'streets',
        paint: {
          'fill-color': '#00f'
        }
      });

      // setup: set and then unset fill-outline-color so that, when we then try
      // to re-set it, StyleTransition#calculate() attempts interpolation
      layer.setPaintProperty('fill-outline-color', '#f00');
      layer.updateTransitions({});
      layer.recalculate({ zoom: 0, zoomHistory: {} });

      layer.setPaintProperty('fill-outline-color', undefined);
      layer.updateTransitions({});
      layer.recalculate({ zoom: 0, zoomHistory: {} });

      // re-set fill-outline-color and get its value, triggering the attempt
      // to interpolate between undefined and #f00
      layer.setPaintProperty('fill-outline-color', '#f00');
      layer.updateTransitions({});
      layer.recalculate({ zoom: 0, zoomHistory: {} });

      layer._paint.get('fill-outline-color');
    });
  });

  await t.test('sets null property value', t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background'
    });

    layer.setPaintProperty('background-color-transition', null);

    t.assert.deepEqual(layer.getPaintProperty('background-color-transition'), null);
  });
});

test('StyleLayer.setLayoutProperty', async t => {
  await t.test('sets new property value', t => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol'
    });

    layer.setLayoutProperty('text-transform', 'lowercase');

    t.assert.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
  });

  await t.test('updates property value', t => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      layout: {
        'text-transform': 'uppercase'
      }
    });

    layer.setLayoutProperty('text-transform', 'lowercase');

    t.assert.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
  });

  await t.test('unsets property value', t => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      layout: {
        'text-transform': 'uppercase'
      }
    });

    layer.setLayoutProperty('text-transform', null);
    layer.recalculate({ zoom: 0, zoomHistory: {} });

    t.assert.deepEqual(layer._layout.get('text-transform').value, { kind: 'constant', value: 'none' });
    t.assert.equal(layer.getLayoutProperty('text-transform'), undefined);
  });
});

test('StyleLayer.setFilter', async t => {
  await t.test('sets new filter referencing global state', () => {
    const layer = createStyleLayer(
      {
        id: 'symbol',
        type: 'symbol',
        source: 'source'
      },
      { showSymbol: true }
    );
    layer.setFilter(['==', ['global-state', 'showSymbol'], true]);

    t.assert.deepEqual(layer.getLayoutAffectingGlobalStateRefs(), new Set(['showSymbol']));
    t.assert.equal(layer._featureFilter({}), true);
  });
});

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
        'text-size': ['global-state', 'textSize'],
        'text-transform': ['global-state', 'textTransform']
      }
    });

    t.assert.deepEqual(layer.getLayoutAffectingGlobalStateRefs(), new Set(['textSize', 'textTransform']));
  });
});

test('StyleLayer.getPaintAffectingGlobalStateRefs', async t => {
  await t.test('returns empty map when no global state references', () => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#000000'
      }
    });

    t.assert.deepEqual(layer.getPaintAffectingGlobalStateRefs(), new Map());
  });

  await t.test('returns global-state references from paint properties', () => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      source: 'source',
      paint: {
        'text-color': ['global-state', 'color'],
        'text-halo-color': ['global-state', 'color'],
        'text-halo-width': 1,
        'text-opacity': ['global-state', 'opacity']
      }
    });
    const expectMap = new Map();
    expectMap.set('color', [
      {
        name: 'text-color',
        value: ['global-state', 'color']
      },
      {
        name: 'text-halo-color',
        value: ['global-state', 'color']
      }
    ]);
    expectMap.set('opacity', [
      {
        name: 'text-opacity',
        value: ['global-state', 'opacity']
      }
    ]);

    t.assert.deepEqual(layer.getPaintAffectingGlobalStateRefs(), expectMap);
  });
});

test('StyleLayer.globalState', async t => {
  await t.test('uses layer global state when recalculating layout properties', t => {
    const layer = createStyleLayer(
      {
        id: 'symbol',
        type: 'symbol',
        layout: {
          'text-field': '{text}',
          'text-size': ['global-state', 'textSize'],
          'text-transform': ['global-state', 'textTransform']
        }
      },
      { textSize: 15, textTransform: 'uppercase' }
    );

    layer.recalculate({ zoom: 0 });

    t.assert.equal(layer._layout.get('text-size').evaluate(), 15);
    t.assert.equal(layer._layout.get('text-transform').evaluate(), 'uppercase');
  });

  await t.test('uses global state from parameters if not set on layer when recalculating layout properties', t => {
    const layer = createStyleLayer({
      id: 'circle',
      type: 'circle',
      paint: {
        'circle-color': ['global-state', 'color'],
        'circle-radius': ['global-state', 'radius']
      }
    });

    layer.recalculate({ zoom: 0, globalState: { radius: 15, color: '#FF0000' } });

    t.assert.deepEqual(layer._paint.get('circle-color').evaluate(), new Color(1, 0, 0, 1));
    t.assert.equal(layer._paint.get('circle-radius').evaluate(), 15);
  });
});
