const test = require('node:test');
const { default: Point } = require('@mapbox/point-geometry');
const checkMaxAngle = require('../../../src/symbol/check_max_angle');
const Anchor = require('../../../src/symbol/anchor');

test('line with no sharp angles', t => {
  const line = [new Point(0, 0), new Point(20, -1), new Point(40, 1), new Point(60, 0)];
  const anchor = new Anchor(30, 0, 0, 1);
  t.assert.ok(checkMaxAngle(line, anchor, 25, 20, Math.PI / 8));
  t.assert.ok(!checkMaxAngle(line, anchor, 25, 20, 0));
});

test('one sharp corner', t => {
  const line = [new Point(0, 0), new Point(0, 10), new Point(10, 10)];
  const anchor = new Anchor(0, 10, 0, 1);
  t.assert.ok(checkMaxAngle(line, anchor, 10, 5, Math.PI / 2));
  t.assert.ok(!checkMaxAngle(line, anchor, 10, 5, Math.PI / 2 - 0.01));
});

test('many small corners close together', t => {
  const line = [
    new Point(0, 0),
    new Point(10, 0),
    new Point(11, 0.1),
    new Point(12, 0.3),
    new Point(13, 0.6),
    new Point(14, 1),
    new Point(13.9, 10)
  ];
  const anchor = new Anchor(12, 0.3, 0, 3);
  t.assert.ok(!checkMaxAngle(line, anchor, 10, 5, Math.PI / 2), 'not allowed if angle within window is big');
  t.assert.ok(checkMaxAngle(line, anchor, 10, 2, Math.PI / 2), 'allowed if window is small enough');
});

test('label appears on the first line segment', t => {
  const line = [new Point(0, 0), new Point(100, 0)];
  const anchor = new Point(50, 0, 0, 0);
  t.assert.ok(checkMaxAngle(line, anchor, 30, 5, Math.PI / 2));
});

test('not enough space before the end of the line', t => {
  const line = [new Point(0, 0), new Point(10, 0), new Point(20, 0), new Point(30, 0)];
  const anchor = new Anchor(5, 0, 0, 0);
  t.assert.ok(!checkMaxAngle(line, anchor, 11, 5, Math.PI));
  t.assert.ok(checkMaxAngle(line, anchor, 10, 5, Math.PI));
});

test('not enough space after the beginning of the line', t => {
  const line = [new Point(0, 0), new Point(10, 0), new Point(20, 0), new Point(30, 0)];
  const anchor = new Anchor(25, 0, 0, 2);
  t.assert.ok(!checkMaxAngle(line, anchor, 11, 5, Math.PI));
  t.assert.ok(checkMaxAngle(line, anchor, 10, 5, Math.PI));
});
