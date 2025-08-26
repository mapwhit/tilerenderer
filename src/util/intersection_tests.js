import { isCounterClockwise } from './util.js';

export function polygonIntersectsPolygon(polygonA, polygonB) {
  for (const point of polygonA) {
    if (polygonContainsPoint(polygonB, point)) {
      return true;
    }
  }

  for (const point of polygonB) {
    if (polygonContainsPoint(polygonA, point)) {
      return true;
    }
  }

  if (lineIntersectsLine(polygonA, polygonB)) {
    return true;
  }

  return false;
}

export function polygonIntersectsBufferedPoint(polygon, point, radius) {
  if (polygonContainsPoint(polygon, point)) {
    return true;
  }
  if (pointIntersectsBufferedLine(point, polygon, radius)) {
    return true;
  }
  return false;
}

export function polygonIntersectsMultiPolygon(polygon, multiPolygon) {
  if (polygon.length === 1) {
    return multiPolygonContainsPoint(multiPolygon, polygon[0]);
  }

  for (const ring of multiPolygon) {
    for (const point of ring) {
      if (polygonContainsPoint(polygon, point)) {
        return true;
      }
    }
  }

  for (const point of polygon) {
    if (multiPolygonContainsPoint(multiPolygon, point)) {
      return true;
    }
  }

  for (const line of multiPolygon) {
    if (lineIntersectsLine(polygon, line)) {
      return true;
    }
  }

  return false;
}

export function polygonIntersectsBufferedMultiLine(polygon, multiLine, radius) {
  for (const line of multiLine) {
    if (polygon.length >= 3) {
      for (const point of line) {
        if (polygonContainsPoint(polygon, point)) {
          return true;
        }
      }
    }

    if (lineIntersectsBufferedLine(polygon, line, radius)) {
      return true;
    }
  }
  return false;
}

function lineIntersectsBufferedLine(lineA, lineB, radius) {
  if (lineA.length > 1) {
    if (lineIntersectsLine(lineA, lineB)) {
      return true;
    }

    // Check whether any point in either line is within radius of the other line
    for (const point of lineB) {
      if (pointIntersectsBufferedLine(point, lineA, radius)) {
        return true;
      }
    }
  }

  for (const point of lineA) {
    if (pointIntersectsBufferedLine(point, lineB, radius)) {
      return true;
    }
  }

  return false;
}

function lineIntersectsLine(lineA, lineB) {
  if (lineA.length === 0 || lineB.length === 0) {
    return false;
  }
  let a0 = lineA[0];
  for (let i = 1; i < lineA.length; i++) {
    const a1 = lineA[i];
    let b0 = lineB[0];
    for (let j = 1; j < lineB.length; j++) {
      const b1 = lineB[j];
      if (lineSegmentIntersectsLineSegment(a0, a1, b0, b1)) {
        return true;
      }
      b0 = b1;
    }
    a0 = a1;
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
  const radiusSquared = radius ** 2;

  if (line.length === 1) {
    return p.distSqr(line[0]) < radiusSquared;
  }

  let v = line[0];
  for (let i = 1; i < line.length; i++) {
    // Find line segments that have a distance <= radius^2 to p
    // In that case, we treat the line as "containing point p".
    const w = line[i];
    if (distToSegmentSquared(p, v, w) < radiusSquared) {
      return true;
    }
    v = w;
  }
  return false;
}

// Code from http://stackoverflow.com/a/1501725/331379.
export function distToSegmentSquared(p, v, w) {
  const l2 = distSqr(v, w);
  if (l2 === 0) {
    return distSqr(p, v);
  }
  const t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  if (t < 0) {
    return distSqr(p, v);
  }
  if (t > 1) {
    return distSqr(p, w);
  }
  return distSqr(p, {
    x: (w.x - v.x) * t + v.x,
    y: (w.y - v.y) * t + v.y
  });
}

function distSqr(p, q) {
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
}

// point in polygon ray casting algorithm
function multiPolygonContainsPoint(rings, { x, y }) {
  let c = false;

  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const p1 = ring[i];
      const p2 = ring[j];
      if (p1.y > y !== p2.y > y && x < ((p2.x - p1.x) * (y - p1.y)) / (p2.y - p1.y) + p1.x) {
        c = !c;
      }
    }
  }
  return c;
}

function polygonContainsPoint(ring, { x, y }) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p1 = ring[i];
    const p2 = ring[j];
    if (p1.y > y !== p2.y > y && x < ((p2.x - p1.x) * (y - p1.y)) / (p2.y - p1.y) + p1.x) {
      c = !c;
    }
  }
  return c;
}

export function polygonIntersectsBox(ring, boxX1, boxY1, boxX2, boxY2) {
  for (const { x, y } of ring) {
    if (boxX1 <= x && boxY1 <= y && boxX2 >= x && boxY2 >= y) {
      return true;
    }
  }

  const corners = [
    { x: boxX1, y: boxY1 },
    { x: boxX1, y: boxY2 },
    { x: boxX2, y: boxY2 },
    { x: boxX2, y: boxY1 }
  ];

  if (ring.length > 2) {
    for (const corner of corners) {
      if (polygonContainsPoint(ring, corner)) {
        return true;
      }
    }
  }

  let p1 = ring[0];
  for (let i = 1; i < ring.length; i++) {
    const p2 = ring[i];
    if (edgeIntersectsBox(p1, p2, corners)) {
      return true;
    }
    p1 = p2;
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
  ) {
    return false;
  }

  // check if all corners of the box are on the same side of the edge
  const dir = isCounterClockwise(e1, e2, corners[0]);
  return (
    dir !== isCounterClockwise(e1, e2, corners[1]) ||
    dir !== isCounterClockwise(e1, e2, corners[2]) ||
    dir !== isCounterClockwise(e1, e2, corners[3])
  );
}
