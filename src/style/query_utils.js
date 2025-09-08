import glMatrix from '@mapbox/gl-matrix';
import { polygonIntersectsBufferedPoint } from '@mapwhit/geometry';
import { Point } from '@mapwhit/point-geometry';

const { vec4 } = glMatrix;

export function getMaximumPaintValue(property, layer, bucket) {
  const value = layer._paint.get(property).value;
  if (value.kind === 'constant') {
    return value.value;
  }
  const binders = bucket.programConfigurations.get(layer.id).binders;
  return binders[property].maxValue;
}

export function translateDistance(translate) {
  return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

export function translate(queryGeometry, translate, translateAnchor, bearing, pixelsToTileUnits) {
  if (!translate[0] && !translate[1]) {
    return queryGeometry;
  }

  const pt = new Point(translate[0], translate[1])._mult(pixelsToTileUnits);

  if (translateAnchor === 'viewport') {
    pt._rotate(-bearing);
  }

  pt;

  return queryGeometry.map(point => point.sub(pt));
}

const circleIntersectionTests = new Map([
  [
    'map',
    new Map([
      [
        'map',
        ({ queryGeometry, point, size }) => {
          return polygonIntersectsBufferedPoint(queryGeometry, point, size);
        }
      ],
      [
        'viewport',
        ({ queryGeometry, point, pixelPosMatrix, size, transform }) => {
          const projectedCenter = vec4.transformMat4([], [point.x, point.y, 0, 1], pixelPosMatrix);
          const adjustedSize = (size * projectedCenter[3]) / transform.cameraToCenterDistance;
          return polygonIntersectsBufferedPoint(queryGeometry, point, adjustedSize);
        }
      ]
    ])
  ],
  [
    'viewport',
    new Map([
      [
        'map',
        ({ queryGeometry, point, pixelPosMatrix, size, transform }) => {
          const projectedCenter = vec4.transformMat4([], [point.x, point.y, 0, 1], pixelPosMatrix);
          const adjustedSize = (size * transform.cameraToCenterDistance) / projectedCenter[3];
          return polygonIntersectsBufferedPoint(queryGeometry, projectPoint(point, pixelPosMatrix), adjustedSize);
        }
      ],
      [
        'viewport',
        ({ queryGeometry, point, pixelPosMatrix, size }) => {
          return polygonIntersectsBufferedPoint(queryGeometry, projectPoint(point, pixelPosMatrix), size);
        }
      ]
    ])
  ]
]);

export function circleIntersection({
  queryGeometry,
  geometry,
  pixelPosMatrix,
  size,
  transform,
  pitchAlignment = 'map',
  pitchScale = 'map'
}) {
  const intersectionTest = circleIntersectionTests.get(pitchAlignment).get(pitchScale);
  const param = { queryGeometry, pixelPosMatrix, size, transform };
  for (const ring of geometry) {
    for (const point of ring) {
      param.point = point;
      if (intersectionTest(param)) {
        return true;
      }
    }
  }
  return false;
}

function projectPoint(p, pixelPosMatrix) {
  const point = vec4.transformMat4([], [p.x, p.y, 0, 1], pixelPosMatrix);
  return new Point(point[0] / point[3], point[1] / point[3]);
}

export function projectQueryGeometry(queryGeometry, pixelPosMatrix) {
  return queryGeometry.map(p => {
    return projectPoint(p, pixelPosMatrix);
  });
}
