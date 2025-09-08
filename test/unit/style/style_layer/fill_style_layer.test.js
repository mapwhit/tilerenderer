import test from 'node:test';
import { getIntersectionDistance } from '../../../../src/style/style_layer/fill_extrusion_style_layer.js';

test('getIntersectionDistance', async t => {
  const queryPoint = [{ x: 100, y: 100 }];
  const z = 7;
  const a = { x: 100, y: -90, z };
  const b = { x: 110, y: 110, z };
  const c = { x: -110, y: 110, z };

  await t.test('one point', t => {
    const projectedFace = [a, a];
    t.assert.equal(getIntersectionDistance(queryPoint, projectedFace), Number.POSITIVE_INFINITY);
  });

  await t.test('two points', t => {
    const projectedFace = [a, b, a];
    t.assert.equal(getIntersectionDistance(queryPoint, projectedFace), Number.POSITIVE_INFINITY);
  });

  await t.test('two points coincident', t => {
    const projectedFace = [a, a, a, b, b, b, b, a];
    t.assert.equal(getIntersectionDistance(queryPoint, projectedFace), Number.POSITIVE_INFINITY);
  });

  await t.test('three points', t => {
    const projectedFace = [a, b, c, a];
    t.assert.equal(getIntersectionDistance(queryPoint, projectedFace), z);
  });

  await t.test('three points coincident points', t => {
    const projectedFace = [a, a, b, b, b, c, c, a];
    t.assert.equal(getIntersectionDistance(queryPoint, projectedFace), z);
  });
});
