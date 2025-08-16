const test = require('node:test');
const { mapObject } = require('../../../src/util/object');
const createStyleLayer = require('../../../src/style/create_style_layer');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const { create: createLayers } = require('../../util/layers');

test('StyleLayerIndex.replace', t => {
  const index = new StyleLayerIndex(
    createLayers([
      { id: '1', type: 'fill', source: 'source', 'source-layer': 'layer', paint: { 'fill-color': 'red' } },
      { id: '2', type: 'circle', source: 'source', 'source-layer': 'layer', paint: { 'circle-color': 'green' } },
      { id: '3', type: 'circle', source: 'source', 'source-layer': 'layer', paint: { 'circle-color': 'blue' } }
    ])
  );

  const families = index.familiesBySource['source']['layer'];
  t.assert.equal(families.length, 2);
  t.assert.equal(families[0].length, 1);
  t.assert.equal(families[0][0].id, '1');
  t.assert.equal(families[1].length, 2);
  t.assert.equal(families[1][0].id, '2');
  t.assert.equal(families[1][1].id, '3');

  index.replace([]);
  t.assert.deepEqual(index.familiesBySource, {});
});

test('StyleLayerIndex.update', t => {
  const layers = createLayers([
    { id: '1', type: 'fill', source: 'foo', 'source-layer': 'layer', paint: { 'fill-color': 'red' } },
    { id: '2', type: 'circle', source: 'foo', 'source-layer': 'layer', paint: { 'circle-color': 'green' } },
    { id: '3', type: 'circle', source: 'foo', 'source-layer': 'layer', paint: { 'circle-color': 'blue' } }
  ]);
  const index = new StyleLayerIndex(layers);

  layers.set(
    '1',
    createStyleLayer({
      id: '1',
      type: 'fill',
      source: 'bar',
      'source-layer': 'layer',
      paint: { 'fill-color': 'cyan' }
    })
  );
  layers.set(
    '2',
    createStyleLayer({
      id: '2',
      type: 'circle',
      source: 'bar',
      'source-layer': 'layer',
      paint: { 'circle-color': 'magenta' }
    })
  );
  layers.set(
    '3',
    createStyleLayer({
      id: '3',
      type: 'circle',
      source: 'bar',
      'source-layer': 'layer',
      paint: { 'circle-color': 'yellow' }
    })
  );

  index.update();

  const families = index.familiesBySource['bar']['layer'];
  t.assert.equal(families.length, 2);
  t.assert.equal(families[0].length, 1);
  t.assert.equal(families[0][0].getPaintProperty('fill-color'), 'cyan');
  t.assert.equal(families[1].length, 2);
  t.assert.equal(families[1][0].getPaintProperty('circle-color'), 'magenta');
  t.assert.equal(families[1][0].source, 'bar');
  t.assert.equal(families[1][1].getPaintProperty('circle-color'), 'yellow');
  t.assert.equal(families[1][1].source, 'bar');
});

test('StyleLayerIndex.familiesBySource', t => {
  const index = new StyleLayerIndex(
    createLayers([
      { id: '0', type: 'fill', source: 'A', 'source-layer': 'foo' },
      { id: '1', type: 'fill', source: 'A', 'source-layer': 'foo' },
      { id: '2', type: 'fill', source: 'A', 'source-layer': 'foo', minzoom: 1 },
      { id: '3', type: 'fill', source: 'A', 'source-layer': 'bar' },
      { id: '4', type: 'fill', source: 'B', 'source-layer': 'foo' },
      { id: '5', type: 'fill', source: 'geojson' },
      { id: '6', type: 'background' }
    ])
  );

  const ids = mapObject(index.familiesBySource, bySource => {
    return mapObject(bySource, families => {
      return families.map(family => {
        return family.map(layer => layer.id);
      });
    });
  });

  t.assert.deepEqual(ids, {
    A: {
      foo: [['0', '1'], ['2']],
      bar: [['3']]
    },
    B: {
      foo: [['4']]
    },
    geojson: {
      _geojsonTileLayer: [['5']]
    },
    '': {
      _geojsonTileLayer: [['6']]
    }
  });
});

test('StyleLayerIndex groups families even if layout key order differs', t => {
  const index = new StyleLayerIndex(
    createLayers([
      {
        id: '0',
        type: 'line',
        source: 'source',
        'source-layer': 'layer',
        layout: { 'line-cap': 'butt', 'line-join': 'miter' }
      },
      {
        id: '1',
        type: 'line',
        source: 'source',
        'source-layer': 'layer',
        layout: { 'line-join': 'miter', 'line-cap': 'butt' }
      }
    ])
  );

  const families = index.familiesBySource['source']['layer'];
  t.assert.equal(families[0].length, 2);
});
