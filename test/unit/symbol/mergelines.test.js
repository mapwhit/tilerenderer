const test = require('node:test');
const mergeLines = require('../../../src/symbol/mergelines');
const { default: Point } = require('@mapbox/point-geometry');

function makeFeatures(lines) {
  const features = [];
  for (const line of lines) {
    const points = [];
    for (let j = 1; j < line.length; j++) {
      points.push(new Point(line[j], 0));
    }
    features.push({ text: line[0], geometry: [points] });
  }
  return features;
}

test('mergeLines merges lines with the same text', t => {
  t.assert.deepEqual(
    mergeLines(
      makeFeatures([
        ['a', 0, 1, 2],
        ['b', 4, 5, 6],
        ['a', 8, 9],
        ['a', 2, 3, 4],
        ['a', 6, 7, 8],
        ['a', 5, 6]
      ])
    ),
    makeFeatures([
      ['a', 0, 1, 2, 3, 4],
      ['b', 4, 5, 6],
      ['a', 5, 6, 7, 8, 9]
    ])
  );
});

test('mergeLines handles merge from both ends', t => {
  t.assert.deepEqual(
    mergeLines(
      makeFeatures([
        ['a', 0, 1, 2],
        ['a', 4, 5, 6],
        ['a', 2, 3, 4]
      ])
    ),
    makeFeatures([['a', 0, 1, 2, 3, 4, 5, 6]])
  );
});

test('mergeLines handles circular lines', t => {
  t.assert.deepEqual(
    mergeLines(
      makeFeatures([
        ['a', 0, 1, 2],
        ['a', 2, 3, 4],
        ['a', 4, 0]
      ])
    ),
    makeFeatures([['a', 0, 1, 2, 3, 4, 0]])
  );
});
