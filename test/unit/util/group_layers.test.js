import test from 'node:test';
import createStyleLayer from '../../../src/style/create_style_layer.js';
import group from '../../../src/util/group_layers.js';

test('group layers whose key properties are identical', t => {
  const a = createStyleLayer({
    id: 'parent',
    type: 'line'
  });
  const b = createStyleLayer({
    id: 'child',
    type: 'line'
  });
  const groupBySource = group([a, b]);
  t.assert.equal(groupBySource.size, 1);
  const groupBySourceLayer = groupBySource.values().next().value;
  t.assert.equal(groupBySourceLayer.size, 1);
  const groupByLayout = groupBySourceLayer.values().next().value;
  t.assert.equal(groupByLayout.size, 1);
  const layers = Array.from(groupByLayout.values());
  t.assert.deepEqual(layers, [[a, b]]);
  t.assert.equal(layers[0][0], a);
  t.assert.equal(layers[0][1], b);
});

test('group does not group unrelated layers', t => {
  const a = createStyleLayer({
    id: 'parent',
    type: 'line'
  });
  const b = createStyleLayer({
    id: 'child',
    type: 'fill'
  });
  const groupBySource = group([a, b]);
  t.assert.equal(groupBySource.size, 1);
  const groupBySourceLayer = groupBySource.values().next().value;
  t.assert.equal(groupBySourceLayer.size, 1);
  const groupByLayout = groupBySourceLayer.values().next().value;
  t.assert.equal(groupByLayout.size, 2);
  const layers = Array.from(groupByLayout.values());
  t.assert.deepEqual(layers, [[a], [b]]);
  t.assert.equal(layers[0][0], a);
  t.assert.equal(layers[1][0], b);
});

test('group works even for differing layout key orders', t => {
  const a = createStyleLayer({
    id: 'parent',
    type: 'line',
    layout: { 'line-miter-limit': 1, 'line-round-limit': 2 }
  });
  const b = createStyleLayer({
    id: 'child',
    type: 'line',
    layout: { 'line-round-limit': 2, 'line-miter-limit': 1 }
  });

  const groupBySource = group([a, b]);
  t.assert.equal(groupBySource.size, 1);
  const groupBySourceLayer = groupBySource.values().next().value;
  t.assert.equal(groupBySourceLayer.size, 1);
  const groupByLayout = groupBySourceLayer.values().next().value;
  t.assert.equal(groupByLayout.size, 1);
  const layers = Array.from(groupByLayout.values());
  t.assert.deepEqual(layers, [[a, b]]);
  t.assert.equal(layers[0][0], a);
  t.assert.equal(layers[0][1], b);
});
