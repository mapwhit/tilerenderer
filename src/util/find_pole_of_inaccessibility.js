import Queue from 'tinyqueue';
import { distToSegmentSquared } from './intersection_tests.js';

/**
 * Finds an approximation of a polygon's Pole Of Inaccessibiliy https://en.wikipedia.org/wiki/Pole_of_inaccessibility
 * This is a copy of http://github.com/mapbox/polylabel adapted to use Points
 *
 * @param polygonRings first item in array is the outer ring followed optionally by the list of holes, should be an element of the result of util/classify_rings
 * @param precision Specified in input coordinate units. If 0 returns after first run, if > 0 repeatedly narrows the search space until the radius of the area searched for the best pole is less than precision
 * @returns Pole of Inaccessibiliy.
 * @private
 */
export default function (polygonRings, precision = 1) {
  // find the bounding box of the outer ring
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const outerRing = polygonRings[0];
  for (const { x, y } of outerRing) {
    if (x < minX) {
      minX = x;
    } else if (x > maxX) {
      maxX = x;
    }
    if (y < minY) {
      minY = y;
    } else if (y > maxY) {
      maxY = y;
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) {
    return { x: minX, y: minY };
  }

  const h = cellSize / 2;
  // cover polygon with initial cells
  const cells = [];
  for (let x = minX; x < maxX; x += cellSize) {
    const xh = x + h;
    for (let y = minY; y < maxY; y += cellSize) {
      cells.push(new Cell(xh, y + h, h, polygonRings));
    }
  }

  // a priority queue of cells in order of their "potential" (max distance to polygon)
  const cellQueue = new Queue(cells, compareMax);

  // take centroid as the first best guess
  let bestCell = getCentroidCell(polygonRings);

  while (cellQueue.length > 0) {
    // pick the most promising cell from the queue
    const cell = cellQueue.pop();

    // update the best cell if we found a better one
    if (cell.d > bestCell.d || bestCell.d === 0) {
      bestCell = cell;
      //  debug('found best %d after %d probes', Math.round(1e4 * cell.d) / 1e4, numProbes);
    }

    // do not drill down further if there's no chance of a better solution
    if (cell.max - bestCell.d <= precision) {
      continue;
    }

    // split the cell into four cells
    const h = cell.h / 2;
    cellQueue.push(new Cell(cell.p.x - h, cell.p.y - h, h, polygonRings));
    cellQueue.push(new Cell(cell.p.x + h, cell.p.y - h, h, polygonRings));
    cellQueue.push(new Cell(cell.p.x - h, cell.p.y + h, h, polygonRings));
    cellQueue.push(new Cell(cell.p.x + h, cell.p.y + h, h, polygonRings));
  }

  // debug(`num probes: ${numProbes}`, `best distance: ${bestCell.d}`);

  return bestCell.p;
}

function compareMax(a, b) {
  return b.max - a.max;
}

class Cell {
  constructor(x, y, h, polygon) {
    this.p = { x, y };
    this.h = h; // half the cell size
    this.d = pointToPolygonDist(this.p, polygon); // distance from cell center to polygon
    this.max = this.d + this.h * Math.SQRT2; // max distance to polygon within a cell
  }
}

// signed distance from point to polygon outline (negative if point is outside)
function pointToPolygonDist(p, polygon) {
  let inside = false;
  let minDistSq = Number.POSITIVE_INFINITY;

  const { x, y } = p;
  for (const ring of polygon) {
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      const a = ring[i];
      const b = ring[j];

      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }

      const distSq = distToSegmentSquared(p, a, b);
      if (distSq < minDistSq) {
        minDistSq = distSq;
      }
    }
  }

  const minDist = Math.sqrt(minDistSq);
  return inside ? minDist : -minDist;
}

// get polygon centroid
function getCentroidCell(polygon) {
  let area = 0;
  let x = 0;
  let y = 0;
  const points = polygon[0];
  for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
    const a = points[i];
    const b = points[j];
    const f = a.x * b.y - b.x * a.y;
    x += (a.x + b.x) * f;
    y += (a.y + b.y) * f;
    area += f * 3;
  }
  return new Cell(x / area, y / area, 0, polygon);
}
