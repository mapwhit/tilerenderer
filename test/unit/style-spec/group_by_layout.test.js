const test = require('node:test');
const group = require('../../../src/style-spec/group_by_layout');

test('group layers whose ref properties are identical', t => {
  const a = {
    id: 'parent',
    type: 'line'
  };
  const b = {
    id: 'child',
    type: 'line'
  };
  t.assert.deepEqual(group([a, b]), [[a, b]]);
  t.assert.equal(group([a, b])[0][0], a);
  t.assert.equal(group([a, b])[0][1], b);
});

test('group does not group unrelated layers', t => {
  t.assert.deepEqual(
    group([
      {
        id: 'parent',
        type: 'line'
      },
      {
        id: 'child',
        type: 'fill'
      }
    ]),
    [
      [
        {
          id: 'parent',
          type: 'line'
        }
      ],
      [
        {
          id: 'child',
          type: 'fill'
        }
      ]
    ]
  );
});

test('group works even for differing layout key orders', t => {
  t.assert.deepEqual(
    group([
      {
        id: 'parent',
        type: 'line',
        layout: { a: 1, b: 2 }
      },
      {
        id: 'child',
        type: 'line',
        layout: { b: 2, a: 1 }
      }
    ]),
    [
      [
        {
          id: 'parent',
          type: 'line',
          layout: { a: 1, b: 2 }
        },
        {
          id: 'child',
          type: 'line',
          layout: { b: 2, a: 1 }
        }
      ]
    ]
  );
});
