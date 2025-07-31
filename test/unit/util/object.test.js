const test = require('node:test').test;
const {
  arraysIntersect,
  bindAll,
  clone,
  deepEqual,
  filterObject,
  keysDifference,
  mapObject,
  pick
} = require('../../../src/util/object');

test('object', async t => {
  t.assert.deepEqual(keysDifference({ a: 1 }, {}), ['a'], 'keysDifference');
  t.assert.deepEqual(keysDifference({ a: 1 }, { a: 1 }), [], 'keysDifference');
  t.assert.deepEqual(pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 }, 'pick');
  t.assert.deepEqual(pick({ a: 1, b: 2, c: 3 }, ['a', 'c', 'd']), { a: 1, c: 3 }, 'pick');

  await t.test('bindAll', (t, done) => {
    function MyClass() {
      bindAll(['ontimer'], this);
      this.name = 'Tom';
    }
    MyClass.prototype.ontimer = function () {
      t.assert.equal(this.name, 'Tom');
      done();
    };
    const my = new MyClass();
    setTimeout(my.ontimer, 0);
  });

  await t.test('map', t => {
    t.assert.deepEqual(
      mapObject({}, () => {
        t.assert.fail();
      }),
      {}
    );
    const that = {};
    t.assert.deepEqual(
      mapObject(
        { map: 'box' },
        function (value, key, object) {
          t.assert.equal(value, 'box');
          t.assert.equal(key, 'map');
          t.assert.deepEqual(object, { map: 'box' });
          t.assert.equal(this, that);
          return 'BOX';
        },
        that
      ),
      { map: 'BOX' }
    );
  });

  await t.test('filter', t => {
    t.assert.deepEqual(
      filterObject({}, () => {
        t.assert.fail();
      }),
      {}
    );
    const that = {};
    filterObject(
      { map: 'box' },
      function (value, key, object) {
        t.assert.equal(value, 'box');
        t.assert.equal(key, 'map');
        t.assert.deepEqual(object, { map: 'box' });
        t.assert.equal(this, that);
        return true;
      },
      that
    );
    t.assert.deepEqual(
      filterObject({ map: 'box', box: 'map' }, value => {
        return value === 'box';
      }),
      { map: 'box' }
    );
  });

  await t.test('deepEqual', t => {
    const a = {
      foo: 'bar',
      bar: {
        baz: 5,
        lol: ['cat', 2]
      }
    };
    const b = JSON.parse(JSON.stringify(a));
    const c = JSON.parse(JSON.stringify(a));
    c.bar.lol[0] = 'z';

    t.assert.ok(deepEqual(a, b));
    t.assert.ok(!deepEqual(a, c));
    t.assert.ok(!deepEqual(a, null));
    t.assert.ok(!deepEqual(null, c));
    t.assert.ok(deepEqual(null, null));
  });

  await t.test('clone', async t => {
    await t.test('array', t => {
      const input = [false, 1, 'two'];
      const output = clone(input);
      t.assert.notEqual(input, output);
      t.assert.deepEqual(input, output);
    });

    await t.test('object', t => {
      const input = { a: false, b: 1, c: 'two' };
      const output = clone(input);
      t.assert.notEqual(input, output);
      t.assert.deepEqual(input, output);
    });

    await t.test('deep object', t => {
      const input = { object: { a: false, b: 1, c: 'two' } };
      const output = clone(input);
      t.assert.notEqual(input.object, output.object);
      t.assert.deepEqual(input.object, output.object);
    });

    await t.test('deep array', t => {
      const input = { array: [false, 1, 'two'] };
      const output = clone(input);
      t.assert.notEqual(input.array, output.array);
      t.assert.deepEqual(input.array, output.array);
    });
  });

  await t.test('arraysIntersect', async t => {
    await t.test('intersection', t => {
      const a = ['1', '2', '3'];
      const b = ['5', '4', '3'];

      t.assert.equal(arraysIntersect(a, b), true);
    });

    await t.test('no intersection', t => {
      const a = ['1', '2', '3'];
      const b = ['4', '5', '6'];

      t.assert.equal(arraysIntersect(a, b), false);
    });
  });
});
