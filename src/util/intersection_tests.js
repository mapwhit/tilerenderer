const { isCounterClockwise } = require('./util');
const { default: Point } = require('@mapbox/point-geometry');

module.exports = {
  polygonIntersectsBufferedPoint,
  polygonIntersectsMultiPolygon,
  polygonIntersectsBufferedMultiLine,
  polygonIntersectsPolygon,
  distToSegmentSquared,
  polygonIntersectsBox
};

function polygonIntersectsPolygon(polygonA, polygonB) {
  for (let i = 0; i < polygonA.length; i++) {
    if (polygonContainsPoint(polygonB, polygonA[i])) return true;
  }

  for (let i = 0; i < polygonB.length; i++) {
    if (polygonContainsPoint(polygonA, polygonB[i])) return true;
  }

  if (lineIntersectsLine(polygonA, polygonB)) return true;

  return false;
}

function polygonIntersectsBufferedPoint(polygon, point, radius) {
  if (polygonContainsPoint(polygon, point)) return true;
  if (pointIntersectsBufferedLine(point, polygon, radius)) return true;
  return false;
}

function polygonIntersectsMultiPolygon(polygon, multiPolygon) {
  if (polygon.length === 1) {
    return multiPolygonContainsPoint(multiPolygon, polygon[0]);
  }

  for (let m = 0; m < multiPolygon.length; m++) {
    const ring = multiPolygon[m];
    for (let n = 0; n < ring.length; n++) {
      if (polygonContainsPoint(polygon, ring[n])) return true;
    }
  }

  for (let i = 0; i < polygon.length; i++) {
    if (multiPolygonContainsPoint(multiPolygon, polygon[i])) return true;
  }

  for (let k = 0; k < multiPolygon.length; k++) {
    if (lineIntersectsLine(polygon, multiPolygon[k])) return true;
  }

  return false;
}

function polygonIntersectsBufferedMultiLine(polygon, multiLine, radius) {
  for (let i = 0; i < multiLine.length; i++) {
    const line = multiLine[i];

    if (polygon.length >= 3) {
      for (let k = 0; k < line.length; k++) {
        if (polygonContainsPoint(polygon, line[k])) return true;
      }
    }

    if (lineIntersectsBufferedLine(polygon, line, radius)) return true;
  }
  return false;
}

function lineIntersectsBufferedLine(lineA, lineB, radius) {
  if (lineA.length > 1) {
    if (lineIntersectsLine(lineA, lineB)) return true;

    // Check whether any point in either line is within radius of the other line
    for (let j = 0; j < lineB.length; j++) {
      if (pointIntersectsBufferedLine(lineB[j], lineA, radius)) return true;
    }
  }

  for (let k = 0; k < lineA.length; k++) {
    if (pointIntersectsBufferedLine(lineA[k], lineB, radius)) return true;
  }

  return false;
}

function lineIntersectsLine(lineA, lineB) {
  if (lineA.length === 0 || lineB.length === 0) return false;
  for (let i = 0; i < lineA.length - 1; i++) {
    const a0 = lineA[i];
    const a1 = lineA[i + 1];
    for (let j = 0; j < lineB.length - 1; j++) {
      const b0 = lineB[j];
      const b1 = lineB[j + 1];
      if (lineSegmentIntersectsLineSegment(a0, a1, b0, b1)) return true;
    }
  }
  return false;
}

function lineSegmentIntersectsLineSegment(a0, a1, b0, b1) {
  return (
    isCounterClockwise(a0, b0, b1) !== isCounterClockwise(a1, b0, b1) &&
    isCounterClockwise(a0, a1, b0) !== isCounterClockwise(a0, a1, b1)
  );
}

function pointIntersectsBufferedLine(p, line, radius) {
  const radiusSquared = radius * radius;

  if (line.length === 1) return p.distSqr(line[0]) < radiusSquared;

  for (let i = 1; i < line.length; i++) {
    // Find line segments that have a distance <= radius^2 to p
    // In that case, we treat the line as "containing point p".
    const v = line[i - 1];
    const w = line[i];
    if (distToSegmentSquared(p, v, w) < radiusSquared) return true;
  }
  return false;
}

// Code from http://stackoverflow.com/a/1501725/331379.
function distToSegmentSquared(p, v, w) {
  const l2 = v.distSqr(w);
  if (l2 === 0) return p.distSqr(v);
  const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  if (t < 0) return p.distSqr(v);
  if (t > 1) return p.distSqr(w);
  return p.distSqr(w.sub(v)._mult(t)._add(v));
}

// point in polygon ray casting algorithm
function multiPolygonContainsPoint(rings, p) {
  let c = false;
  let ring;
  let p1;
  let p2;

  for (let k = 0; k < rings.length; k++) {
    ring = rings[k];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      p1 = ring[i];
      p2 = ring[j];
      if (p1.y > p.y !== p2.y > p.y && p.x < ((p2.x - p1.x) * (p.y - p1.y)) / (p2.y - p1.y) + p1.x) {
        c = !c;
      }
    }
  }
  return c;
}

function polygonContainsPoint(ring, p) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[i];
    const p2 = ring[j];
    if (p1.y > p.y !== p2.y > p.y && p.x < ((p2.x - p1.x) * (p.y - p1.y)) / (p2.y - p1.y) + p1.x) {
      c = !c;
    }
  }
  return c;
}

function polygonIntersectsBox(ring, boxX1, boxY1, boxX2, boxY2) {
  for (const p of ring) {
    if (boxX1 <= p.x && boxY1 <= p.y && boxX2 >= p.x && boxY2 >= p.y) return true;
  }

  const corners = [new Point(boxX1, boxY1), new Point(boxX1, boxY2), new Point(boxX2, boxY2), new Point(boxX2, boxY1)];

  if (ring.length > 2) {
    for (const corner of corners) {
      if (polygonContainsPoint(ring, corner)) return true;
    }
  }

  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    if (edgeIntersectsBox(p1, p2, corners)) return true;
  }

  return false;
}

function edgeIntersectsBox(e1, e2, corners) {
  const tl = corners[0];
  const br = corners[2];
  // the edge and box do not intersect in either the x or y dimensions
  if (
    (e1.x < tl.x && e2.x < tl.x) ||
    (e1.x > br.x && e2.x > br.x) ||
    (e1.y < tl.y && e2.y < tl.y) ||
    (e1.y > br.y && e2.y > br.y)
  )
    return false;

  // check if all corners of the box are on the same side of the edge
  const dir = isCounterClockwise(e1, e2, corners[0]);
  return (
    dir !== isCounterClockwise(e1, e2, corners[1]) ||
    dir !== isCounterClockwise(e1, e2, corners[2]) ||
    dir !== isCounterClockwise(e1, e2, corners[3])
  );
}
