const { test } = require('../../util/mapbox-gl-js-test');
const { StructArrayLayout3i6, FeatureIndexArray } = require('../../../src/data/array_types');

test('StructArray', async t => {
  class TestArray extends StructArrayLayout3i6 {}

  await t.test('array constructs itself', t => {
    const array = new TestArray();
    t.equal(array.length, 0);
    t.ok(array.arrayBuffer);
  });

  await t.test('emplaceBack', t => {
    const array = new TestArray();

    t.equal(0, array.emplaceBack(1, 7, 3));
    t.equal(1, array.emplaceBack(4, 2, 5));

    t.equal(array.length, 2);

    t.deepEqual(array.int16.slice(0, 6), Int16Array.from([1, 7, 3, 4, 2, 5]));
  });

  await t.test('emplaceBack gracefully accepts extra arguments', t => {
    // emplaceBack is typically used in fairly hot code paths, where
    // conditionally varying the number of arguments can be expensive.
    const array = new TestArray();
    t.equal(
      array /*: any*/
        .emplaceBack(3, 1, 4, 1, 5, 9),
      0
    );
    t.equal(array.length, 1);
    t.deepEqual(array.int16.slice(0, 3), Int16Array.from([3, 1, 4]));
  });

  await t.test('reserve', t => {
    const array = new TestArray();

    array.reserve(100);
    const initialCapacity = array.capacity;

    for (let i = 0; i < 100; i++) {
      array.emplaceBack(1, 1, 1);
      t.equal(array.capacity, initialCapacity);
    }
  });

  await t.test('automatically resizes', t => {
    const array = new TestArray();
    const initialCapacity = array.capacity;

    while (initialCapacity > array.length) {
      array.emplaceBack(1, 1, 1);
    }

    t.equal(array.capacity, initialCapacity);

    array.emplaceBack(1, 1, 1);
    t.ok(array.capacity > initialCapacity);
  });

  await t.test('trims', t => {
    const array = new TestArray();
    const capacityInitial = array.capacity;

    array.emplaceBack(1, 1, 1);
    t.equal(array.capacity, capacityInitial);

    array._trim();
    t.equal(array.capacity, 1);
    t.equal(array.arrayBuffer.byteLength, array.bytesPerElement);
  });
});

test('FeatureIndexArray', async t => {
  class TestArray extends FeatureIndexArray {}

  await t.test('array constructs itself', t => {
    const array = new TestArray();
    t.equal(array.length, 0);
    t.ok(array.arrayBuffer);
  });

  await t.test('emplace and retrieve', t => {
    const array = new TestArray();
    t.equal(0, array.emplaceBack(1, 7, 3));
    t.equal(1, array.emplaceBack(4, 2, 5));

    t.equal(array.length, 2);

    const elem0 = array.get(0);
    t.ok(elem0);

    t.equal(elem0.featureIndex, 1, 'returns correct featureIndex');
    t.equal(elem0.sourceLayerIndex, 7, 'returns correct sourceLayerIndex');
    t.equal(elem0.bucketIndex, 3, 'returns correct bucketIndex');

    const elem1 = array.get(1);
    t.ok(elem1);

    t.equal(elem1.featureIndex, 4, 'returns correct featureIndex');
    t.equal(elem1.sourceLayerIndex, 2, 'returns correct sourceLayerIndex');
    t.equal(elem1.bucketIndex, 5, 'returns correct bucketIndex');
  });
});
