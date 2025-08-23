import test from 'node:test';
import LngLat from '../../../src/geo/lng_lat.js';

test('LngLat', async t => {
  await t.test('constructor', t => {
    t.assert.ok(new LngLat(0, 0) instanceof LngLat, 'creates an object');
    t.assert.throws(
      () => {
        new LngLat('foo', 0);
      },
      { message: 'Invalid LngLat object: (foo, 0)' },
      'detects and throws on invalid input'
    );
    t.assert.throws(
      () => {
        new LngLat(0, -91);
      },
      { message: 'Invalid LngLat latitude value: must be between -90 and 90' },
      'detects and throws on invalid input'
    );
    t.assert.throws(
      () => {
        new LngLat(0, 91);
      },
      { message: 'Invalid LngLat latitude value: must be between -90 and 90' },
      'detects and throws on invalid input'
    );
  });

  await t.test('convert', t => {
    t.assert.ok(LngLat.convert([0, 10]) instanceof LngLat, 'convert creates a LngLat instance');
    t.assert.ok(LngLat.convert([0, 10, 0]) instanceof LngLat, 'convert creates a LngLat instance (Elevation)');
    t.assert.throws(
      () => {
        LngLat.convert([0, 10, 0, 5]);
      },
      {
        message:
          '`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]'
      },
      'detects and throws on invalid input'
    );
    t.assert.ok(LngLat.convert({ lng: 0, lat: 10 }) instanceof LngLat, 'convert creates a LngLat instance');
    t.assert.ok(LngLat.convert({ lng: 0, lat: 0 }) instanceof LngLat, 'convert creates a LngLat instance');
    t.assert.ok(LngLat.convert({ lng: 0, lat: 0, elev: 0 }) instanceof LngLat, 'convert creates a LngLat instance');
    t.assert.ok(LngLat.convert(new LngLat(0, 0)) instanceof LngLat, 'convert creates a LngLat instance');
    t.assert.throws(
      () => {
        LngLat.convert(0, 10);
      },
      {
        message:
          '`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]'
      },
      'detects and throws on invalid input'
    );
  });

  await t.test('wrap', t => {
    t.assert.deepEqual(new LngLat(0, 0).wrap(), { lng: 0, lat: 0 });
    t.assert.deepEqual(new LngLat(10, 20).wrap(), { lng: 10, lat: 20 });
    t.assert.deepEqual(new LngLat(360, 0).wrap(), { lng: 0, lat: 0 });
    t.assert.deepEqual(new LngLat(190, 0).wrap(), { lng: -170, lat: 0 });
  });

  await t.test('toArray', t => {
    t.assert.deepEqual(new LngLat(10, 20).toArray(), [10, 20]);
  });

  await t.test('toString', t => {
    t.assert.equal(new LngLat(10, 20).toString(), 'LngLat(10, 20)');
  });

  await t.test('toBounds', t => {
    t.assert.deepEqual(new LngLat(0, 0).toBounds(10).toArray(), [
      [-0.00008983152770714982, -0.00008983152770714982],
      [0.00008983152770714982, 0.00008983152770714982]
    ]);
    t.assert.deepEqual(new LngLat(-73.9749, 40.7736).toBounds(10).toArray(), [
      [-73.97501862141328, 40.77351016847229],
      [-73.97478137858673, 40.77368983152771]
    ]);
  });
});
