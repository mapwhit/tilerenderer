import { test } from 'node:test';
import * as async from '../../../src/util/async.js';

test('async', async t => {
  await t.test('asyncAll - sync', (t, done) => {
    async.all(
      [0, 1, 2],
      (data, callback) => {
        callback(null, data);
      },
      (err, results) => {
        t.assert.ifError(err);
        t.assert.deepEqual(results, [0, 1, 2]);
        done();
      }
    );
  });

  await t.test('asyncAll - async', (t, done) => {
    async.all(
      [4, 0, 1, 2],
      (data, callback) => {
        setTimeout(() => {
          callback(null, data);
        }, data);
      },
      (err, results) => {
        t.assert.ifError(err);
        t.assert.deepEqual(results, [4, 0, 1, 2]);
        done();
      }
    );
  });

  await t.test('asyncAll - error', (t, done) => {
    async.all(
      [4, 0, 1, 2],
      (data, callback) => {
        setTimeout(() => {
          callback(new Error('hi'), data);
        }, data);
      },
      (err, results) => {
        t.assert.equal(err?.message, 'hi');
        t.assert.deepEqual(results, [4, 0, 1, 2]);
        done();
      }
    );
  });

  await t.test('asyncAll - empty', (t, done) => {
    async.all(
      [],
      (data, callback) => {
        callback(null, 'foo');
      },
      (err, results) => {
        t.assert.ifError(err);
        t.assert.deepEqual(results, []);
        done();
      }
    );
  });

  await t.test('asyncAll', (t, done) => {
    let expect = 1;
    async.all(
      [],
      callback => {
        callback();
      },
      () => {
        t.assert.ok('immediate callback');
      }
    );
    async.all(
      [1, 2, 3],
      (number, callback) => {
        t.assert.equal(number, expect++);
        t.assert.ok(callback instanceof Function);
        callback(null, 0);
      },
      () => {
        done();
      }
    );
  });
});
