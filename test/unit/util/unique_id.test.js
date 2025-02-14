'use strict';

const test = require('mapbox-gl-js-test').test;
const uniqueId = require('../../../src/util/unique_id');

test('unique_id', async t => {
  t.assert.equal(typeof uniqueId(), 'number', 'should be a number');
  const id1 = uniqueId();
  const id2 = uniqueId();
  t.assert.notEqual(id1, id2, 'uniqueId uniqueness');
});
