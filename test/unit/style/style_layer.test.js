const test = require('node:test');
const createStyleLayer = require('../../../src/style/create_style_layer');
const FillStyleLayer = require('../../../src/style/style_layer/fill_style_layer');
const { Color } = require('@mapwhit/style-expressions');

test('StyleLayer', async t => {
  await t.test('instantiates the correct subclass', t => {
    const layer = createStyleLayer({ type: 'fill' });

    t.assert.ok(layer instanceof FillStyleLayer);
  });
});

test('StyleLayer#setPaintProperty', async t => {
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

    t.assert.deepEqual(layer.paint.get('background-color'), new Color(0, 0, 0, 1));
    t.assert.equal(layer.getPaintProperty('background-color'), undefined);
    t.assert.equal(layer.paint.get('background-opacity'), 1);
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
    t.assert.deepEqual(layer.paint.get('fill-outline-color').value, { kind: 'constant', value: new Color(1, 0, 0, 1) });

    layer.setPaintProperty('fill-outline-color', undefined);
    layer.updateTransitions({});
    layer.recalculate({ zoom: 0, zoomHistory: {} });
    t.assert.deepEqual(layer.paint.get('fill-outline-color').value, { kind: 'constant', value: new Color(0, 0, 1, 1) });
  });

  await t.test('can transition fill-outline-color from undefined to a value #3657', t => {
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

    layer.paint.get('fill-outline-color');
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

test('StyleLayer#setLayoutProperty', async t => {
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

    t.assert.deepEqual(layer.layout.get('text-transform').value, { kind: 'constant', value: 'none' });
    t.assert.equal(layer.getLayoutProperty('text-transform'), undefined);
  });
});

test('StyleLayer#getLayoutAffectingGlobalStateRefs', async t => {
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

test('StyleLayer#serialize', async t => {
  function createSymbolLayer(layer) {
    return Object.assign(
      {
        id: 'symbol',
        type: 'symbol',
        paint: {
          'text-color': 'blue'
        },
        layout: {
          'text-transform': 'uppercase'
        }
      },
      layer
    );
  }

  await t.test('serializes layers', t => {
    t.assert.deepEqual(createStyleLayer(createSymbolLayer()).serialize(), createSymbolLayer());
  });

  await t.test('serializes functions', t => {
    const layerPaint = {
      'text-color': {
        base: 2,
        stops: [
          [0, 'red'],
          [1, 'blue']
        ]
      }
    };

    t.assert.deepEqual(createStyleLayer(createSymbolLayer({ paint: layerPaint })).serialize().paint, layerPaint);
  });

  await t.test('serializes added paint properties', t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setPaintProperty('text-halo-color', 'orange');

    t.assert.equal(layer.serialize().paint['text-halo-color'], 'orange');
    t.assert.equal(layer.serialize().paint['text-color'], 'blue');
  });

  await t.test('serializes added layout properties', t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setLayoutProperty('text-size', 20);

    t.assert.equal(layer.serialize().layout['text-transform'], 'uppercase');
    t.assert.equal(layer.serialize().layout['text-size'], 20);
  });
});

test('StyleLayer#serialize', async t => {
  function createSymbolLayer(layer) {
    return Object.assign(
      {
        id: 'symbol',
        type: 'symbol',
        paint: {
          'text-color': 'blue'
        },
        layout: {
          'text-transform': 'uppercase'
        }
      },
      layer
    );
  }

  await t.test('serializes layers', t => {
    t.assert.deepEqual(createStyleLayer(createSymbolLayer()).serialize(), createSymbolLayer());
  });

  await t.test('serializes functions', t => {
    const layerPaint = {
      'text-color': {
        base: 2,
        stops: [
          [0, 'red'],
          [1, 'blue']
        ]
      }
    };

    t.assert.deepEqual(createStyleLayer(createSymbolLayer({ paint: layerPaint })).serialize().paint, layerPaint);
  });

  await t.test('serializes added paint properties', t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setPaintProperty('text-halo-color', 'orange');

    t.assert.equal(layer.serialize().paint['text-halo-color'], 'orange');
    t.assert.equal(layer.serialize().paint['text-color'], 'blue');
  });

  await t.test('serializes added layout properties', t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setLayoutProperty('text-size', 20);

    t.assert.equal(layer.serialize().layout['text-transform'], 'uppercase');
    t.assert.equal(layer.serialize().layout['text-size'], 20);
  });
});
