const { default: quickselect } = require('quickselect');

const { calculateSignedArea } = require('./util');

// classifies an array of rings into polygons with outer rings and holes
module.exports = function classifyRings(rings, maxRings) {
  if (rings.length <= 1) return [rings];

  const polygons = [];
  let polygon;
  let ccw;

  for (const ring of rings) {
    const area = calculateSignedArea(ring);
    if (area === 0) continue;

    ring.area = Math.abs(area);

    if (ccw === undefined) ccw = area < 0;

    if (ccw === area < 0) {
      append(polygon);
      polygon = [ring];
    } else {
      polygon.push(ring);
    }
  }
  append(polygon);
  return polygons;

  function append(polygon) {
    if (!polygon) {
      return;
    }
    // Earcut performance degrades with the # of rings in a polygon. For this
    // reason, we limit strip out all but the `maxRings` largest rings.
    if (maxRings > 1 && maxRings < polygon.length) {
      quickselect(polygon, maxRings, 1, polygon.length - 1, (a, b) => b.area - a.area);
      polygon.length = maxRings;
    }
    polygons.push(polygon);
  }
};
