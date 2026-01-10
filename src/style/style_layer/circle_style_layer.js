import CircleBucket from '../../data/bucket/circle_bucket.js';
import {
  circleIntersection,
  getMaximumPaintValue,
  projectQueryGeometry,
  translate,
  translateDistance
} from '../query_utils.js';
import StyleLayer from '../style_layer.js';
import properties from './circle_style_layer_properties.js';

export default class CircleStyleLayer extends StyleLayer {
  constructor(layer, globalState) {
    super(layer, properties, globalState);
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

    let transformedPolygon;
    let transformedSize;
    if (pitchAlignment === 'map') {
      transformedPolygon = translatedPolygon;
      transformedSize = size * pixelsToTileUnits;
    } else {
      transformedPolygon = projectQueryGeometry(translatedPolygon, pixelPosMatrix);
      transformedSize = size;
    }

    return circleIntersection({
      queryGeometry: transformedPolygon,
      geometry,
      pixelPosMatrix,
      size: transformedSize,
      transform,
      pitchAlignment,
      pitchScale
    });
  }
}
