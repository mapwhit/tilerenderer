const StyleLayer = require('../style_layer');

const FillExtrusionBucket = require('../../data/bucket/fill_extrusion_bucket');
const { polygonIntersectsPolygon, polygonIntersectsMultiPolygon } = require('../../util/intersection_tests');
const { translateDistance, translate } = require('../query_utils');
const properties = require('./fill_extrusion_style_layer_properties');
const { vec4 } = require('@mapbox/gl-matrix');
const { default: Point } = require('@mapbox/point-geometry');

class FillExtrusionStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  createBucket(parameters) {
    return new FillExtrusionBucket(parameters);
  }

  queryRadius() {
    return translateDistance(this.paint.get('fill-extrusion-translate'));
  }

  is3D() {
    return true;
  }

  queryIntersectsFeature(
    queryGeometry,
    feature,
    featureState,
    geometry,
    zoom,
    transform,
    pixelsToTileUnits,
    pixelPosMatrix
  ) {
    const translatedPolygon = translate(
      queryGeometry,
      this.paint.get('fill-extrusion-translate'),
      this.paint.get('fill-extrusion-translate-anchor'),
      transform.angle,
      pixelsToTileUnits
    );
    const height = this.paint.get('fill-extrusion-height').evaluate(feature, featureState);
    const base = this.paint.get('fill-extrusion-base').evaluate(feature, featureState);

    const projectedQueryGeometry = projectQueryGeometry(translatedPolygon, pixelPosMatrix, transform, 0);

    const projected = projectExtrusion(geometry, base, height, pixelPosMatrix);
    const projectedBase = projected[0];
    const projectedTop = projected[1];
    return checkIntersection(projectedBase, projectedTop, projectedQueryGeometry);
  }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function getIntersectionDistance(projectedQueryGeometry, projectedFace) {
  if (projectedQueryGeometry.length === 1) {
    // For point queries calculate the z at which the point intersects the face
    // using barycentric coordinates.

    // Find the barycentric coordinates of the projected point within the first
    // triangle of the face, using only the xy plane. It doesn't matter if the
    // point is outside the first triangle because all the triangles in the face
    // are in the same plane.
    const a = projectedFace[0];
    const b = projectedFace[1];
    const c = projectedFace[3];
    const p = projectedQueryGeometry[0];

    const ab = b.sub(a);
    const ac = c.sub(a);
    const ap = p.sub(a);

    const dotABAB = dot(ab, ab);
    const dotABAC = dot(ab, ac);
    const dotACAC = dot(ac, ac);
    const dotAPAB = dot(ap, ab);
    const dotAPAC = dot(ap, ac);
    const denom = dotABAB * dotACAC - dotABAC * dotABAC;
    const v = (dotACAC * dotAPAB - dotABAC * dotAPAC) / denom;
    const w = (dotABAB * dotAPAC - dotABAC * dotAPAB) / denom;
    const u = 1 - v - w;

    // Use the barycentric weighting along with the original triangle z coordinates to get the point of intersection.
    return a.z * u + b.z * v + c.z * w;
  }
  // The counts as closest is less clear when the query is a box. This
  // returns the distance to the nearest point on the face, whether it is
  // within the query or not. It could be more correct to return the
  // distance to the closest point within the query box but this would be
  // more complicated and expensive to calculate with little benefit.
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const p of projectedFace) {
    closestDistance = Math.min(closestDistance, p.z);
  }
  return closestDistance;
}

function checkIntersection(projectedBase, projectedTop, projectedQueryGeometry) {
  let closestDistance = Number.POSITIVE_INFINITY;

  if (polygonIntersectsMultiPolygon(projectedQueryGeometry, projectedTop)) {
    closestDistance = getIntersectionDistance(projectedQueryGeometry, projectedTop[0]);
  }

  for (let r = 0; r < projectedTop.length; r++) {
    const ringTop = projectedTop[r];
    const ringBase = projectedBase[r];
    for (let p = 0; p < ringTop.length - 1; p++) {
      const topA = ringTop[p];
      const topB = ringTop[p + 1];
      const baseA = ringBase[p];
      const baseB = ringBase[p + 1];
      const face = [topA, topB, baseB, baseA, topA];
      if (polygonIntersectsPolygon(projectedQueryGeometry, face)) {
        closestDistance = Math.min(closestDistance, getIntersectionDistance(projectedQueryGeometry, face));
      }
    }
  }

  return closestDistance === Number.POSITIVE_INFINITY ? false : closestDistance;
}

/*
 * Project the geometry using matrix `m`. This is essentially doing
 * `vec4.transformMat4([], [p.x, p.y, z, 1], m)` but the multiplication
 * is inlined so that parts of the projection that are the same across
 * different points can only be done once. This produced a measurable
 * performance improvement.
 */
function projectExtrusion(geometry, zBase, zTop, m) {
  const projectedBase = [];
  const projectedTop = [];

  const baseXZ = m[8] * zBase;
  const baseYZ = m[9] * zBase;
  const baseZZ = m[10] * zBase;
  const baseWZ = m[11] * zBase;
  const topXZ = m[8] * zTop;
  const topYZ = m[9] * zTop;
  const topZZ = m[10] * zTop;
  const topWZ = m[11] * zTop;

  for (const r of geometry) {
    const ringBase = [];
    const ringTop = [];
    for (const p of r) {
      const x = p.x;
      const y = p.y;

      const sX = m[0] * x + m[4] * y + m[12];
      const sY = m[1] * x + m[5] * y + m[13];
      const sZ = m[2] * x + m[6] * y + m[14];
      const sW = m[3] * x + m[7] * y + m[15];

      const baseX = sX + baseXZ;
      const baseY = sY + baseYZ;
      const baseZ = sZ + baseZZ;
      const baseW = sW + baseWZ;

      const topX = sX + topXZ;
      const topY = sY + topYZ;
      const topZ = sZ + topZZ;
      const topW = sW + topWZ;

      const b = new Point(baseX / baseW, baseY / baseW);
      b.z = baseZ / baseW;
      ringBase.push(b);

      const t = new Point(topX / topW, topY / topW);
      t.z = topZ / topW;
      ringTop.push(t);
    }
    projectedBase.push(ringBase);
    projectedTop.push(ringTop);
  }
  return [projectedBase, projectedTop];
}

function projectQueryGeometry(queryGeometry, pixelPosMatrix, transform, z) {
  const projectedQueryGeometry = [];
  for (const p of queryGeometry) {
    const v = [p.x, p.y, z, 1];
    vec4.transformMat4(v, v, pixelPosMatrix);
    projectedQueryGeometry.push(new Point(v[0] / v[3], v[1] / v[3]));
  }
  return projectedQueryGeometry;
}

module.exports = FillExtrusionStyleLayer;
