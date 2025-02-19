const { test } = require('../../util/mapbox-gl-js-test');
const createStyleLayer = require('../../../src/style/create_style_layer');
const FillStyleLayer = require('../../../src/style/style_layer/fill_style_layer');
const Color = require('../../../src/style-spec/util/color');

test('StyleLayer', async t => {
  await t.test('instantiates the correct subclass', async t => {
    const layer = createStyleLayer({ type: 'fill' });

    t.ok(layer instanceof FillStyleLayer);
  });
});

test('StyleLayer#setPaintProperty', async t => {
  await t.test('sets new property value', async t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background'
    });

    layer.setPaintProperty('background-color', 'blue');

    t.deepEqual(layer.getPaintProperty('background-color'), 'blue');
  });

  await t.test('updates property value', async t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'red'
      }
    });

    layer.setPaintProperty('background-color', 'blue');

    t.deepEqual(layer.getPaintProperty('background-color'), 'blue');
  });

  await t.test('unsets value', async t => {
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

    t.deepEqual(layer.paint.get('background-color'), new Color(0, 0, 0, 1));
    t.equal(layer.getPaintProperty('background-color'), undefined);
    t.equal(layer.paint.get('background-opacity'), 1);
    t.equal(layer.getPaintProperty('background-opacity'), 1);
  });

  await t.test('preserves existing transition', async t => {
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

    t.deepEqual(layer.getPaintProperty('background-color-transition'), { duration: 600 });
  });

  await t.test('sets transition', async t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background',
      paint: {
        'background-color': 'red'
      }
    });

    layer.setPaintProperty('background-color-transition', { duration: 400 });

    t.deepEqual(layer.getPaintProperty('background-color-transition'), { duration: 400 });
  });

  await t.test('can unset fill-outline-color #2886', async t => {
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
    t.deepEqual(layer.paint.get('fill-outline-color').value, { kind: 'constant', value: new Color(1, 0, 0, 1) });

    layer.setPaintProperty('fill-outline-color', undefined);
    layer.updateTransitions({});
    layer.recalculate({ zoom: 0, zoomHistory: {} });
    t.deepEqual(layer.paint.get('fill-outline-color').value, { kind: 'constant', value: new Color(0, 0, 1, 1) });
  });

  await t.test('can transition fill-outline-color from undefined to a value #3657', async t => {
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

  await t.test('sets null property value', async t => {
    const layer = createStyleLayer({
      id: 'background',
      type: 'background'
    });

    layer.setPaintProperty('background-color-transition', null);

    t.deepEqual(layer.getPaintProperty('background-color-transition'), null);
  });
});

test('StyleLayer#setLayoutProperty', async t => {
  await t.test('sets new property value', async t => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol'
    });

    layer.setLayoutProperty('text-transform', 'lowercase');

    t.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
  });

  await t.test('updates property value', async t => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      layout: {
        'text-transform': 'uppercase'
      }
    });

    layer.setLayoutProperty('text-transform', 'lowercase');

    t.deepEqual(layer.getLayoutProperty('text-transform'), 'lowercase');
  });

  await t.test('unsets property value', async t => {
    const layer = createStyleLayer({
      id: 'symbol',
      type: 'symbol',
      layout: {
        'text-transform': 'uppercase'
      }
    });

    layer.setLayoutProperty('text-transform', null);
    layer.recalculate({ zoom: 0, zoomHistory: {} });

    t.deepEqual(layer.layout.get('text-transform').value, { kind: 'constant', value: 'none' });
    t.equal(layer.getLayoutProperty('text-transform'), undefined);
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

  await t.test('serializes layers', async t => {
    t.deepEqual(createStyleLayer(createSymbolLayer()).serialize(), createSymbolLayer());
  });

  await t.test('serializes functions', async t => {
    const layerPaint = {
      'text-color': {
        base: 2,
        stops: [
          [0, 'red'],
          [1, 'blue']
        ]
      }
    };

    t.deepEqual(createStyleLayer(createSymbolLayer({ paint: layerPaint })).serialize().paint, layerPaint);
  });

  await t.test('serializes added paint properties', async t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setPaintProperty('text-halo-color', 'orange');

    t.equal(layer.serialize().paint['text-halo-color'], 'orange');
    t.equal(layer.serialize().paint['text-color'], 'blue');
  });

  await t.test('serializes added layout properties', async t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setLayoutProperty('text-size', 20);

    t.equal(layer.serialize().layout['text-transform'], 'uppercase');
    t.equal(layer.serialize().layout['text-size'], 20);
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

  await t.test('serializes layers', async t => {
    t.deepEqual(createStyleLayer(createSymbolLayer()).serialize(), createSymbolLayer());
  });

  await t.test('serializes functions', async t => {
    const layerPaint = {
      'text-color': {
        base: 2,
        stops: [
          [0, 'red'],
          [1, 'blue']
        ]
      }
    };

    t.deepEqual(createStyleLayer(createSymbolLayer({ paint: layerPaint })).serialize().paint, layerPaint);
  });

  await t.test('serializes added paint properties', async t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setPaintProperty('text-halo-color', 'orange');

    t.equal(layer.serialize().paint['text-halo-color'], 'orange');
    t.equal(layer.serialize().paint['text-color'], 'blue');
  });

  await t.test('serializes added layout properties', async t => {
    const layer = createStyleLayer(createSymbolLayer());
    layer.setLayoutProperty('text-size', 20);

    t.equal(layer.serialize().layout['text-transform'], 'uppercase');
    t.equal(layer.serialize().layout['text-size'], 20);
  });
});
