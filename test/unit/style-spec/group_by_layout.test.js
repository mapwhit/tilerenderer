const test = require('node:test');
const group = require('../../../src/style-spec/group_by_layout');
const createStyleLayer = require('../../../src/style/create_style_layer');

test('group layers whose ref properties are identical', t => {
  const a = createStyleLayer({
    id: 'parent',
    type: 'line'
  });
  const b = createStyleLayer({
    id: 'child',
    type: 'line'
  });
  t.assert.deepEqual(group([a, b]), [[a, b]]);
  t.assert.equal(group([a, b])[0][0], a);
  t.assert.equal(group([a, b])[0][1], b);
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
  t.assert.deepEqual(group([a, b]), [[a], [b]]);
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

  t.assert.deepEqual(group([a, b]), [[a, b]]);
});
