import test from 'node:test';
import Anchor from '../../../src/symbol/anchor.js';
import checkMaxAngle from '../../../src/symbol/check_max_angle.js';

test('line with no sharp angles', t => {
  const line = [
    { x: 0, y: 0 },
    { x: 20, y: -1 },
    { x: 40, y: 1 },
    { x: 60, y: 0 }
  ];
  const anchor = new Anchor(30, 0, 0, 1);
  t.assert.ok(checkMaxAngle(line, anchor, 25, 20, Math.PI / 8));
  t.assert.ok(!checkMaxAngle(line, anchor, 25, 20, 0));
});

test('one sharp corner', t => {
  const line = [
    { x: 0, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 }
  ];
  const anchor = new Anchor(0, 10, 0, 1);
  t.assert.ok(checkMaxAngle(line, anchor, 10, 5, Math.PI / 2));
  t.assert.ok(!checkMaxAngle(line, anchor, 10, 5, Math.PI / 2 - 0.01));
});

test('many small corners close together', t => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 11, y: 0.1 },
    { x: 12, y: 0.3 },
    { x: 13, y: 0.6 },
    { x: 14, y: 1 },
    { x: 13.9, y: 10 }
  ];
  const anchor = new Anchor(12, 0.3, 0, 3);
  t.assert.ok(!checkMaxAngle(line, anchor, 10, 5, Math.PI / 2), 'not allowed if angle within window is big');
  t.assert.ok(checkMaxAngle(line, anchor, 10, 2, Math.PI / 2), 'allowed if window is small enough');
});

test('label appears on the first line segment', t => {
  const line = [
    { x: 0, y: 0 },
    { x: 100, y: 0 }
  ];
  const anchor = new Anchor(50, 0, 0, 0);
  t.assert.ok(checkMaxAngle(line, anchor, 30, 5, Math.PI / 2));
});

test('not enough space before the end of the line', t => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 }
  ];
  const anchor = new Anchor(5, 0, 0, 0);
  t.assert.ok(!checkMaxAngle(line, anchor, 11, 5, Math.PI));
  t.assert.ok(checkMaxAngle(line, anchor, 10, 5, Math.PI));
});

test('not enough space after the beginning of the line', t => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 }
  ];
  const anchor = new Anchor(25, 0, 0, 2);
  t.assert.ok(!checkMaxAngle(line, anchor, 11, 5, Math.PI));
  t.assert.ok(checkMaxAngle(line, anchor, 10, 5, Math.PI));
});
