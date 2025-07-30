const { test } = require('../../util/mapbox-gl-js-test');
const createFilter = require('../../../src/style-spec/feature_filter');
const convertFilter = require('../../../src/style-spec/feature_filter/convert');

test('filter', async t => {
  await t.test('expression, zoom', t => {
    const f = createFilter(['>=', ['number', ['get', 'x']], ['zoom']]);
    t.assert.equal(f({ zoom: 1 }, { properties: { x: 0 } }), false);
    t.assert.equal(f({ zoom: 1 }, { properties: { x: 1.5 } }), true);
    t.assert.equal(f({ zoom: 1 }, { properties: { x: 2.5 } }), true);
    t.assert.equal(f({ zoom: 2 }, { properties: { x: 0 } }), false);
    t.assert.equal(f({ zoom: 2 }, { properties: { x: 1.5 } }), false);
    t.assert.equal(f({ zoom: 2 }, { properties: { x: 2.5 } }), true);
  });

  await t.test('expression, compare two properties', t => {
    t.stub(console, 'warn');
    const f = createFilter(['==', ['string', ['get', 'x']], ['string', ['get', 'y']]]);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: 1, y: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: '1', y: '1' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: 'same', y: 'same' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: undefined } }), false);
  });

  await t.test('expression, collator comparison', t => {
    const caseSensitive = createFilter([
      '==',
      ['string', ['get', 'x']],
      ['string', ['get', 'y']],
      ['collator', { 'case-sensitive': true }]
    ]);
    t.assert.equal(caseSensitive({ zoom: 0 }, { properties: { x: 'a', y: 'b' } }), false);
    t.assert.equal(caseSensitive({ zoom: 0 }, { properties: { x: 'a', y: 'A' } }), false);
    t.assert.equal(caseSensitive({ zoom: 0 }, { properties: { x: 'a', y: 'a' } }), true);

    const caseInsensitive = createFilter([
      '==',
      ['string', ['get', 'x']],
      ['string', ['get', 'y']],
      ['collator', { 'case-sensitive': false }]
    ]);
    t.assert.equal(caseInsensitive({ zoom: 0 }, { properties: { x: 'a', y: 'b' } }), false);
    t.assert.equal(caseInsensitive({ zoom: 0 }, { properties: { x: 'a', y: 'A' } }), true);
    t.assert.equal(caseInsensitive({ zoom: 0 }, { properties: { x: 'a', y: 'a' } }), true);
  });

  await t.test('expression, any/all', t => {
    t.assert.equal(createFilter(['all'])(), true);
    t.assert.equal(createFilter(['all', true])(), true);
    t.assert.equal(createFilter(['all', true, false])(), false);
    t.assert.equal(createFilter(['all', true, true])(), true);
    t.assert.equal(createFilter(['any'])(), false);
    t.assert.equal(createFilter(['any', true])(), true);
    t.assert.equal(createFilter(['any', true, false])(), true);
    t.assert.equal(createFilter(['any', false, false])(), false);
  });

  await t.test('expression, type error', t => {
    t.assert.throws(() => {
      createFilter(['==', ['number', ['get', 'x']], ['string', ['get', 'y']]]);
    });

    t.assert.throws(() => {
      createFilter(['number', ['get', 'x']]);
    });

    t.assert.doesNotThrow(() => {
      createFilter(['boolean', ['get', 'x']]);
    });
  });

  await legacyFilterTests(t, createFilter);
});

test('getGlobalStateRefs', async t => {
  await t.test('returns global-state keys', () => {
    const filter = createFilter(['==', ['global-state', 'x'], ['zoom']]);
    t.assert.deepEqual(filter.getGlobalStateRefs(), new Set(['x']));
  });
});

test('convert legacy filters to expressions', async t => {
  await legacyFilterTests(t, f => {
    const converted = convertFilter(f);
    return createFilter(converted);
  });

  await t.test('mimic legacy type mismatch semantics', t => {
    const filter = ['any', ['all', ['>', 'y', 0], ['>', 'y', 0]], ['>', 'x', 0]];

    const converted = convertFilter(filter);
    const f = createFilter(converted);

    t.assert.equal(f({ zoom: 0 }, { properties: { x: 0, y: 1, z: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: 1, y: 0, z: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: 0, y: 0, z: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: null, y: 1, z: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: 1, y: null, z: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { x: null, y: null, z: 1 } }), false);
  });
});

async function legacyFilterTests(t, filter) {
  await t.test('degenerate', t => {
    t.assert.equal(filter()(), true);
    t.assert.equal(filter(undefined)(), true);
    t.assert.equal(filter(null)(), true);
  });

  await t.test('==, string', t => {
    const f = filter(['==', 'foo', 'bar']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 'bar' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 'baz' } }), false);
  });

  await t.test('==, number', t => {
    const f = filter(['==', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('==, null', t => {
    const f = filter(['==', 'foo', null]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), true);
    // t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('==, $type', t => {
    const f = filter(['==', '$type', 'LineString']);
    t.assert.equal(f({ zoom: 0 }, { type: 1 }), false);
    t.assert.equal(f({ zoom: 0 }, { type: 2 }), true);
  });

  await t.test('==, $id', t => {
    const f = filter(['==', '$id', 1234]);

    t.assert.equal(f({ zoom: 0 }, { id: 1234 }), true);
    t.assert.equal(f({ zoom: 0 }, { id: '1234' }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { id: 1234 } }), false);
  });

  await t.test('!=, string', t => {
    const f = filter(['!=', 'foo', 'bar']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 'bar' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 'baz' } }), true);
  });

  await t.test('!=, number', t => {
    const f = filter(['!=', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), true);
  });

  await t.test('!=, null', t => {
    const f = filter(['!=', 'foo', null]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    // t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), true);
  });

  await t.test('!=, $type', t => {
    const f = filter(['!=', '$type', 'LineString']);
    t.assert.equal(f({ zoom: 0 }, { type: 1 }), true);
    t.assert.equal(f({ zoom: 0 }, { type: 2 }), false);
  });

  await t.test('<, number', t => {
    const f = filter(['<', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('<, string', t => {
    const f = filter(['<', 'foo', '0']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
  });

  await t.test('<=, number', t => {
    const f = filter(['<=', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('<=, string', t => {
    const f = filter(['<=', 'foo', '0']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
  });

  await t.test('>, number', t => {
    const f = filter(['>', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('>, string', t => {
    const f = filter(['>', 'foo', '0']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
  });

  await t.test('>=, number', t => {
    const f = filter(['>=', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('>=, string', t => {
    const f = filter(['>=', 'foo', '0']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: -1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '1' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '-1' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
  });

  await t.test('in, degenerate', t => {
    const f = filter(['in', 'foo']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
  });

  await t.test('in, string', t => {
    const f = filter(['in', 'foo', '0']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('in, number', t => {
    const f = filter(['in', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
  });

  await t.test('in, null', t => {
    const f = filter(['in', 'foo', null]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), true);
    // t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
  });

  await t.test('in, multiple', t => {
    const f = filter(['in', 'foo', 0, 1]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 3 } }), false);
  });

  await t.test('in, large_multiple', t => {
    const values = Array.apply(null, { length: 2000 }).map(Number.call, Number);
    values.reverse();
    const f = filter(['in', 'foo'].concat(values));
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1999 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 2000 } }), false);
  });

  await t.test('in, large_multiple, heterogeneous', t => {
    const values = Array.apply(null, { length: 2000 }).map(Number.call, Number);
    values.push('a');
    values.unshift('b');
    const f = filter(['in', 'foo'].concat(values));
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 'b' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 'a' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1999 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 2000 } }), false);
  });

  await t.test('in, $type', t => {
    const f = filter(['in', '$type', 'LineString', 'Polygon']);
    t.assert.equal(f({ zoom: 0 }, { type: 1 }), false);
    t.assert.equal(f({ zoom: 0 }, { type: 2 }), true);
    t.assert.equal(f({ zoom: 0 }, { type: 3 }), true);

    const f1 = filter(['in', '$type', 'Polygon', 'LineString', 'Point']);
    t.assert.equal(f1({ zoom: 0 }, { type: 1 }), true);
    t.assert.equal(f1({ zoom: 0 }, { type: 2 }), true);
    t.assert.equal(f1({ zoom: 0 }, { type: 3 }), true);
  });

  await t.test('!in, degenerate', t => {
    const f = filter(['!in', 'foo']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
  });

  await t.test('!in, string', t => {
    const f = filter(['!in', 'foo', '0']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), true);
  });

  await t.test('!in, number', t => {
    const f = filter(['!in', 'foo', 0]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), true);
  });

  await t.test('!in, null', t => {
    const f = filter(['!in', 'foo', null]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    // t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), true);
  });

  await t.test('!in, multiple', t => {
    const f = filter(['!in', 'foo', 0, 1]);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 3 } }), true);
  });

  await t.test('!in, large_multiple', t => {
    const f = filter(['!in', 'foo'].concat(Array.apply(null, { length: 2000 }).map(Number.call, Number)));
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1999 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 2000 } }), true);
  });

  await t.test('!in, $type', t => {
    const f = filter(['!in', '$type', 'LineString', 'Polygon']);
    t.assert.equal(f({ zoom: 0 }, { type: 1 }), true);
    t.assert.equal(f({ zoom: 0 }, { type: 2 }), false);
    t.assert.equal(f({ zoom: 0 }, { type: 3 }), false);
  });

  await t.test('any', t => {
    const f1 = filter(['any']);
    t.assert.equal(f1({ zoom: 0 }, { properties: { foo: 1 } }), false);

    const f2 = filter(['any', ['==', 'foo', 1]]);
    t.assert.equal(f2({ zoom: 0 }, { properties: { foo: 1 } }), true);

    const f3 = filter(['any', ['==', 'foo', 0]]);
    t.assert.equal(f3({ zoom: 0 }, { properties: { foo: 1 } }), false);

    const f4 = filter(['any', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.assert.equal(f4({ zoom: 0 }, { properties: { foo: 1 } }), true);
  });

  await t.test('all', t => {
    const f1 = filter(['all']);
    t.assert.equal(f1({ zoom: 0 }, { properties: { foo: 1 } }), true);

    const f2 = filter(['all', ['==', 'foo', 1]]);
    t.assert.equal(f2({ zoom: 0 }, { properties: { foo: 1 } }), true);

    const f3 = filter(['all', ['==', 'foo', 0]]);
    t.assert.equal(f3({ zoom: 0 }, { properties: { foo: 1 } }), false);

    const f4 = filter(['all', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.assert.equal(f4({ zoom: 0 }, { properties: { foo: 1 } }), false);
  });

  await t.test('none', t => {
    const f1 = filter(['none']);
    t.assert.equal(f1({ zoom: 0 }, { properties: { foo: 1 } }), true);

    const f2 = filter(['none', ['==', 'foo', 1]]);
    t.assert.equal(f2({ zoom: 0 }, { properties: { foo: 1 } }), false);

    const f3 = filter(['none', ['==', 'foo', 0]]);
    t.assert.equal(f3({ zoom: 0 }, { properties: { foo: 1 } }), true);

    const f4 = filter(['none', ['==', 'foo', 0], ['==', 'foo', 1]]);
    t.assert.equal(f4({ zoom: 0 }, { properties: { foo: 1 } }), false);
  });

  await t.test('has', t => {
    const f = filter(['has', 'foo']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: true } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), true);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), false);
  });

  await t.test('!has', t => {
    const f = filter(['!has', 'foo']);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 0 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: 1 } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: '0' } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: false } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: null } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: { foo: undefined } }), false);
    t.assert.equal(f({ zoom: 0 }, { properties: {} }), true);
  });
}
