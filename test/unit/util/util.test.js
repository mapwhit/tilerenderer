const test = require('node:test');

const Coordinate = require('../../../src/geo/coordinate');
const {
  easeCubicInOut,
  getCoordinatesCenter,
  clamp,
  wrap,
  bezier,
  isCounterClockwise,
  isClosedPolygon
} = require('../../../src/util/util');
const { default: Point } = require('@mapbox/point-geometry');

test('util', async t => {
  t.assert.equal(easeCubicInOut(0), 0, 'easeCubicInOut=0');
  t.assert.equal(easeCubicInOut(0.2), 0.03200000000000001);
  t.assert.equal(easeCubicInOut(0.5), 0.5, 'easeCubicInOut=0.5');
  t.assert.equal(easeCubicInOut(1), 1, 'easeCubicInOut=1');

  await t.test('getCoordinatesCenter', t => {
    t.assert.deepEqual(
      getCoordinatesCenter([new Coordinate(0, 0, 2), new Coordinate(1, 1, 2)]),
      new Coordinate(0.5, 0.5, 0)
    );
  });

  await t.test('clamp', t => {
    t.assert.equal(clamp(0, 0, 1), 0);
    t.assert.equal(clamp(1, 0, 1), 1);
    t.assert.equal(clamp(200, 0, 180), 180);
    t.assert.equal(clamp(-200, 0, 180), 0);
  });

  await t.test('wrap', t => {
    t.assert.equal(wrap(0, 0, 1), 1);
    t.assert.equal(wrap(1, 0, 1), 1);
    t.assert.equal(wrap(200, 0, 180), 20);
    t.assert.equal(wrap(-200, 0, 180), 160);
  });

  await t.test('bezier', t => {
    const curve = bezier(0, 0, 0.25, 1);
    t.assert.ok(curve instanceof Function, 'returns a function');
    t.assert.equal(curve(0), 0);
    t.assert.equal(curve(1), 1);
    t.assert.equal(curve(0.5), 0.8230854638965502);
  });

  await t.test('isCounterClockwise ', async t => {
    await t.test('counter clockwise', t => {
      const a = new Point(0, 0);
      const b = new Point(1, 0);
      const c = new Point(1, 1);

      t.assert.equal(isCounterClockwise(a, b, c), true);
    });

    await t.test('clockwise', t => {
      const a = new Point(0, 0);
      const b = new Point(1, 0);
      const c = new Point(1, 1);

      t.assert.equal(isCounterClockwise(c, b, a), false);
    });
  });

  await t.test('isClosedPolygon', async t => {
    await t.test('not enough points', t => {
      const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1)];

      t.assert.equal(isClosedPolygon(polygon), false);
    });

    await t.test('not equal first + last point', t => {
      const polygon = [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(1, 1)];

      t.assert.equal(isClosedPolygon(polygon), false);
    });

    await t.test('closed polygon', t => {
      const polygon = [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(0, 1), new Point(0, 0)];

      t.assert.equal(isClosedPolygon(polygon), true);
    });
  });
});
