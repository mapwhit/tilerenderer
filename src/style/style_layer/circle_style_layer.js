import glMatrix from '@mapbox/gl-matrix';
import Point from '@mapbox/point-geometry';
import CircleBucket from '../../data/bucket/circle_bucket.js';
import { polygonIntersectsBufferedPoint } from '../../util/intersection_tests.js';
import { getMaximumPaintValue, translate, translateDistance } from '../query_utils.js';
import StyleLayer from '../style_layer.js';
import properties from './circle_style_layer_properties.js';

const { vec4 } = glMatrix;

class CircleStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  createBucket(parameters) {
    return new CircleBucket(parameters);
  }

  queryRadius(bucket) {
    const circleBucket = bucket;
    return (
      getMaximumPaintValue('circle-radius', this, circleBucket) +
      getMaximumPaintValue('circle-stroke-width', this, circleBucket) +
      translateDistance(this._paint.get('circle-translate'))
    );
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
      this._paint.get('circle-translate'),
      this._paint.get('circle-translate-anchor'),
      transform.angle,
      pixelsToTileUnits
    );
    const radius = this._paint.get('circle-radius').evaluate(feature, featureState);
    const stroke = this._paint.get('circle-stroke-width').evaluate(feature, featureState);
    const size = radius + stroke;

    // For pitch-alignment: map, compare feature geometry to query geometry in the plane of the tile
    // // Otherwise, compare geometry in the plane of the viewport
    // // A circle with fixed scaling relative to the viewport gets larger in tile space as it moves into the distance
    // // A circle with fixed scaling relative to the map gets smaller in viewport space as it moves into the distance
    const pitchScale = this._paint.get('circle-pitch-scale');
    const pitchAlignment = this._paint.get('circle-pitch-alignment');
    const alignWithMap = pitchAlignment === 'map';
    const alignWithViewport = pitchAlignment === 'viewport';
    const transformedPolygon = alignWithMap
      ? translatedPolygon
      : projectQueryGeometry(translatedPolygon, pixelPosMatrix);
    const transformedSize = alignWithMap ? size * pixelsToTileUnits : size;
    const adjustViewportToMap = pitchScale === 'viewport' && alignWithMap;
    const adjustMapToViewport = pitchScale === 'map' && alignWithViewport;

    for (const ring of geometry) {
      for (const point of ring) {
        const transformedPoint = alignWithMap ? point : projectPoint(point, pixelPosMatrix);

        let adjustedSize = transformedSize;
        const projectedCenter = vec4.transformMat4([], [point.x, point.y, 0, 1], pixelPosMatrix);
        if (adjustViewportToMap) {
          adjustedSize *= projectedCenter[3] / transform.cameraToCenterDistance;
        } else if (adjustMapToViewport) {
          adjustedSize *= transform.cameraToCenterDistance / projectedCenter[3];
        }

        if (polygonIntersectsBufferedPoint(transformedPolygon, transformedPoint, adjustedSize)) return true;
      }
    }

    return false;
  }
}

function projectPoint(p, pixelPosMatrix) {
  const point = vec4.transformMat4([], [p.x, p.y, 0, 1], pixelPosMatrix);
  return new Point(point[0] / point[3], point[1] / point[3]);
}

function projectQueryGeometry(queryGeometry, pixelPosMatrix) {
  return queryGeometry.map(p => {
    return projectPoint(p, pixelPosMatrix);
  });
}

export default CircleStyleLayer;
