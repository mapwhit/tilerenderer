import { equals, round } from '@mapwhit/point-geometry';

/**
 * Returns the part of a multiline that intersects with the provided rectangular box.
 *
 * @param lines
 * @param x1 the left edge of the box
 * @param y1 the top edge of the box
 * @param x2 the right edge of the box
 * @param y2 the bottom edge of the box
 * @returns lines
 */
export default function clipLine(lines, x1, y1, x2, y2) {
  const clippedLines = [];

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let clippedLine;

    for (let i = 0; i < line.length - 1; i++) {
      let p0 = line[i];
      let p1 = line[i + 1];

      if (p0.x < x1 && p1.x < x1) {
        continue;
      }
      if (p0.x < x1) {
        p0 = round({ x: x1, y: p0.y + (p1.y - p0.y) * ((x1 - p0.x) / (p1.x - p0.x)) });
      } else if (p1.x < x1) {
        p1 = round({ x: x1, y: p0.y + (p1.y - p0.y) * ((x1 - p0.x) / (p1.x - p0.x)) });
      }

      if (p0.y < y1 && p1.y < y1) {
        continue;
      }
      if (p0.y < y1) {
        p0 = round({ x: p0.x + (p1.x - p0.x) * ((y1 - p0.y) / (p1.y - p0.y)), y: y1 });
      } else if (p1.y < y1) {
        p1 = round({ x: p0.x + (p1.x - p0.x) * ((y1 - p0.y) / (p1.y - p0.y)), y: y1 });
      }

      if (p0.x >= x2 && p1.x >= x2) {
        continue;
      }
      if (p0.x >= x2) {
        p0 = round({ x: x2, y: p0.y + (p1.y - p0.y) * ((x2 - p0.x) / (p1.x - p0.x)) });
      } else if (p1.x >= x2) {
        p1 = round({ x: x2, y: p0.y + (p1.y - p0.y) * ((x2 - p0.x) / (p1.x - p0.x)) });
      }

      if (p0.y >= y2 && p1.y >= y2) {
        continue;
      }
      if (p0.y >= y2) {
        p0 = round({ x: p0.x + (p1.x - p0.x) * ((y2 - p0.y) / (p1.y - p0.y)), y: y2 });
      } else if (p1.y >= y2) {
        p1 = round({ x: p0.x + (p1.x - p0.x) * ((y2 - p0.y) / (p1.y - p0.y)), y: y2 });
      }

      if (!clippedLine || !equals(p0, clippedLine[clippedLine.length - 1])) {
        clippedLine = [p0];
        clippedLines.push(clippedLine);
      }

      clippedLine.push(p1);
    }
  }

  return clippedLines;
}
