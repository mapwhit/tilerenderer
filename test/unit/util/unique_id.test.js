import { test } from 'node:test';
import uniqueId from '../../../src/util/unique_id.js';

test('unique_id', t => {
  t.assert.equal(typeof uniqueId(), 'number', 'should be a number');
  const id1 = uniqueId();
  const id2 = uniqueId();
  t.assert.notEqual(id1, id2, 'uniqueId uniqueness');
});
