import { clamp } from '../util/util.js';

/**
 * GridIndex is a data structure for testing the intersection of
 * circles and rectangles in a 2d plane.
 * It is optimized for rapid insertion and querying.
 * GridIndex splits the plane into a set of "cells" and keeps track
 * of which geometries intersect with each cell. At query time,
 * full geometry comparisons are only done for items that share
 * at least one cell. As long as the geometries are relatively
 * uniformly distributed across the plane, this greatly reduces
 * the number of comparisons necessary.
 */
class GridIndex {
  #boxUid = 0;
  #circleUid = 0;

  constructor(width, height, cellSize) {
    // More cells -> fewer geometries to check per cell, but items tend
    // to be split across more cells.
    // Sweet spot allows most small items to fit in one cell
    this.xCellCount = Math.ceil(width / cellSize);
    this.yCellCount = Math.ceil(height / cellSize);

    const size = this.xCellCount * this.yCellCount;
    this.boxCells = new Array(size);
    this.circleCells = new Array(size);
    this.circleKeys = [];
    this.boxKeys = [];
    this.bboxes = [];
    this.circles = [];

    this.width = width;
    this.height = height;
    this.xScale = this.xCellCount / width;
    this.yScale = this.yCellCount / height;
  }

  keysLength() {
    return this.boxKeys.length + this.circleKeys.length;
  }

  insert(key, x1, y1, x2, y2) {
    const { boxCells } = this;
    this.#forEachCell(x1, y1, x2, y2, insertBoxCell, this.#boxUid++);
    this.boxKeys.push(key);
    this.bboxes.push(x1, y1, x2, y2);

    function insertBoxCell(x1, y1, x2, y2, cellIndex, uid) {
      (boxCells[cellIndex] ??= []).push(uid);
    }
  }

  insertCircle(key, x, y, radius) {
    const { circleCells } = this;
    // Insert circle into grid for all cells in the circumscribing square
    // It's more than necessary (by a factor of 4/PI), but fast to insert
    this.#forEachCell(x - radius, y - radius, x + radius, y + radius, insertCircleCell, this.#circleUid++);
    this.circleKeys.push(key);
    this.circles.push(x, y, radius);

    function insertCircleCell(x1, y1, x2, y2, cellIndex, uid) {
      (circleCells[cellIndex] ??= []).push(uid);
    }
  }

  #query(x1, y1, x2, y2, hitTest, predicate) {
    if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
      return hitTest ? false : [];
    }
    const result = [];
    if (x1 <= 0 && y1 <= 0 && this.width <= x2 && this.height <= y2) {
      if (hitTest) {
        return true;
      }
      for (let boxUid = 0; boxUid < this.boxKeys.length; boxUid++) {
        result.push({
          key: this.boxKeys[boxUid],
          x1: this.bboxes[boxUid * 4],
          y1: this.bboxes[boxUid * 4 + 1],
          x2: this.bboxes[boxUid * 4 + 2],
          y2: this.bboxes[boxUid * 4 + 3]
        });
      }
      for (let circleUid = 0; circleUid < this.circleKeys.length; circleUid++) {
        const x = this.circles[circleUid * 3];
        const y = this.circles[circleUid * 3 + 1];
        const radius = this.circles[circleUid * 3 + 2];
        result.push({
          key: this.circleKeys[circleUid],
          x1: x - radius,
          y1: y - radius,
          x2: x + radius,
          y2: y + radius
        });
      }
      return predicate ? result.filter(predicate) : result;
    }
    const queryArgs = {
      hitTest,
      seenUids: { box: {}, circle: {} }
    };
    this.#forEachCell(x1, y1, x2, y2, queryCell, result, queryArgs, predicate);
    return hitTest ? result.length > 0 : result;

    function queryCell(x1, y1, x2, y2, cellIndex, result, queryArgs, predicate) {
      const { seenUids } = queryArgs;
      const boxCell = this.boxCells[cellIndex];
      if (boxCell != null) {
        const { bboxes } = this;
        for (const boxUid of boxCell) {
          if (!seenUids.box[boxUid]) {
            seenUids.box[boxUid] = true;
            const offset = boxUid * 4;
            if (
              x1 <= bboxes[offset + 2] &&
              y1 <= bboxes[offset + 3] &&
              x2 >= bboxes[offset + 0] &&
              y2 >= bboxes[offset + 1] &&
              (!predicate || predicate(this.boxKeys[boxUid]))
            ) {
              if (queryArgs.hitTest) {
                result.push(true);
                return true;
              }
              result.push({
                key: this.boxKeys[boxUid],
                x1: bboxes[offset],
                y1: bboxes[offset + 1],
                x2: bboxes[offset + 2],
                y2: bboxes[offset + 3]
              });
            }
          }
        }
      }
      const circleCell = this.circleCells[cellIndex];
      if (circleCell != null) {
        const { circles } = this;
        for (const circleUid of circleCell) {
          if (!seenUids.circle[circleUid]) {
            seenUids.circle[circleUid] = true;
            const offset = circleUid * 3;
            if (
              circleAndRectCollide(circles[offset], circles[offset + 1], circles[offset + 2], x1, y1, x2, y2) &&
              (!predicate || predicate(this.circleKeys[circleUid]))
            ) {
              if (queryArgs.hitTest) {
                result.push(true);
                return true;
              }
              const x = circles[offset];
              const y = circles[offset + 1];
              const radius = circles[offset + 2];
              result.push({
                key: this.circleKeys[circleUid],
                x1: x - radius,
                y1: y - radius,
                x2: x + radius,
                y2: y + radius
              });
            }
          }
        }
      }
    }
  }

  #queryCircle(x, y, radius, hitTest, predicate) {
    // Insert circle into grid for all cells in the circumscribing square
    // It's more than necessary (by a factor of 4/PI), but fast to insert
    const x1 = x - radius;
    const x2 = x + radius;
    const y1 = y - radius;
    const y2 = y + radius;
    if (x2 < 0 || x1 > this.width || y2 < 0 || y1 > this.height) {
      return hitTest ? false : [];
    }

    // Box query early exits if the bounding box is larger than the grid, but we don't do
    // the equivalent calculation for circle queries because early exit is less likely
    // and the calculation is more expensive
    const result = [];
    const queryArgs = {
      hitTest,
      circle: { x, y, radius },
      seenUids: { box: {}, circle: {} }
    };
    this.#forEachCell(x1, y1, x2, y2, queryCellCircle, result, queryArgs, predicate);
    return hitTest ? result.length > 0 : result;

    function queryCellCircle(x1, y1, x2, y2, cellIndex, result, queryArgs, predicate) {
      const { circle, seenUids } = queryArgs;
      const boxCell = this.boxCells[cellIndex];
      if (boxCell != null) {
        const { bboxes } = this;
        for (const boxUid of boxCell) {
          if (!seenUids.box[boxUid]) {
            seenUids.box[boxUid] = true;
            const offset = boxUid * 4;
            if (
              circleAndRectCollide(
                circle.x,
                circle.y,
                circle.radius,
                bboxes[offset + 0],
                bboxes[offset + 1],
                bboxes[offset + 2],
                bboxes[offset + 3]
              ) &&
              (!predicate || predicate(this.boxKeys[boxUid]))
            ) {
              result.push(true);
              return true;
            }
          }
        }
      }

      const circleCell = this.circleCells[cellIndex];
      if (circleCell != null) {
        const { circles } = this;
        for (const circleUid of circleCell) {
          if (!seenUids.circle[circleUid]) {
            seenUids.circle[circleUid] = true;
            const offset = circleUid * 3;
            if (
              circlesCollide(
                circles[offset],
                circles[offset + 1],
                circles[offset + 2],
                circle.x,
                circle.y,
                circle.radius
              ) &&
              (!predicate || predicate(this.circleKeys[circleUid]))
            ) {
              result.push(true);
              return true;
            }
          }
        }
      }
    }
  }

  query(x1, y1, x2, y2, predicate) {
    return this.#query(x1, y1, x2, y2, false, predicate);
  }

  hitTest(x1, y1, x2, y2, predicate) {
    return this.#query(x1, y1, x2, y2, true, predicate);
  }

  hitTestCircle(x, y, radius, predicate) {
    return this.#queryCircle(x, y, radius, true, predicate);
  }

  #forEachCell(x1, y1, x2, y2, fn, ...args) {
    const { xCellCount, yCellCount, xScale, yScale } = this;
    const cx1 = cellX(x1);
    const cy1 = cellY(y1);
    const cx2 = cellX(x2);
    const cy2 = cellY(y2);

    for (let x = cx1; x <= cx2; x++) {
      for (let y = cy1; y <= cy2; y++) {
        const cellIndex = xCellCount * y + x;
        if (fn.call(this, x1, y1, x2, y2, cellIndex, ...args)) {
          return;
        }
      }
    }

    function cellX(x) {
      return clamp(Math.floor(x * xScale), 0, xCellCount - 1);
    }

    function cellY(y) {
      return clamp(Math.floor(y * yScale), 0, yCellCount - 1);
    }
  }
}

export default GridIndex;

function circlesCollide(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const bothRadii = r1 + r2;
  return bothRadii * bothRadii > dx * dx + dy * dy;
}

function circleAndRectCollide(circleX, circleY, radius, x1, y1, x2, y2) {
  const halfRectWidth = (x2 - x1) / 2;
  const distX = Math.abs(circleX - (x1 + halfRectWidth));
  if (distX > halfRectWidth + radius) {
    return false;
  }

  const halfRectHeight = (y2 - y1) / 2;
  const distY = Math.abs(circleY - (y1 + halfRectHeight));
  if (distY > halfRectHeight + radius) {
    return false;
  }

  if (distX <= halfRectWidth || distY <= halfRectHeight) {
    return true;
  }

  const dx = distX - halfRectWidth;
  const dy = distY - halfRectHeight;
  return dx * dx + dy * dy <= radius * radius;
}
