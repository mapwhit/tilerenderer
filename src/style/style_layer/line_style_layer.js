import Point from '@mapbox/point-geometry';
import LineBucket from '../../data/bucket/line_bucket.js';
import renderColorRamp from '../../util/color_ramp.js';
import { polygonIntersectsBufferedMultiLine } from '../../util/intersection_tests.js';
import EvaluationParameters from '../evaluation_parameters.js';
import { DataDrivenProperty } from '../properties.js';
import { getMaximumPaintValue, translate, translateDistance } from '../query_utils.js';
import StyleLayer from '../style_layer.js';
import properties from './line_style_layer_properties.js';

class LineFloorwidthProperty extends DataDrivenProperty {
  possiblyEvaluate(value, parameters) {
    parameters = new EvaluationParameters(Math.floor(parameters.zoom), {
      now: parameters.now,
      fadeDuration: parameters.fadeDuration,
      zoomHistory: parameters.zoomHistory,
      transition: parameters.transition
    });
    return super.possiblyEvaluate(value, parameters);
  }

  evaluate(value, globals, feature, featureState) {
    globals = Object.assign({}, globals, { zoom: Math.floor(globals.zoom) });
    return super.evaluate(value, globals, feature, featureState);
  }
}

const lineFloorwidthProperty = new LineFloorwidthProperty(properties.paint.properties['line-width'].specification);
lineFloorwidthProperty.useIntegerZoom = true;

class LineStyleLayer extends StyleLayer {
  constructor(layer) {
    super(layer, properties);
  }

  _handleSpecialPaintPropertyUpdate(name) {
    if (name === 'line-gradient') {
      this._updateGradient();
    }
  }

  _updateGradient() {
    const expression = this._transitionablePaint._values['line-gradient'].value.expression;
    this.gradient = renderColorRamp(expression, 'lineProgress');
    this.gradientTexture = null;
  }

  recalculate(parameters) {
    super.recalculate(parameters);

    this._paint._values['line-floorwidth'] = lineFloorwidthProperty.possiblyEvaluate(
      this._transitioningPaint._values['line-width'].value,
      parameters
    );
  }

  createBucket(parameters) {
    return new LineBucket(parameters);
  }

  queryRadius(bucket) {
    const lineBucket = bucket;
    const width = getLineWidth(
      getMaximumPaintValue('line-width', this, lineBucket),
      getMaximumPaintValue('line-gap-width', this, lineBucket)
    );
    const offset = getMaximumPaintValue('line-offset', this, lineBucket);
    return width / 2 + Math.abs(offset) + translateDistance(this._paint.get('line-translate'));
  }

  queryIntersectsFeature(queryGeometry, feature, featureState, geometry, zoom, transform, pixelsToTileUnits) {
    const translatedPolygon = translate(
      queryGeometry,
      this._paint.get('line-translate'),
      this._paint.get('line-translate-anchor'),
      transform.angle,
      pixelsToTileUnits
    );
    const halfWidth =
      (pixelsToTileUnits / 2) *
      getLineWidth(
        this._paint.get('line-width').evaluate(feature, featureState),
        this._paint.get('line-gap-width').evaluate(feature, featureState)
      );
    const lineOffset = this._paint.get('line-offset').evaluate(feature, featureState);
    if (lineOffset) {
      geometry = offsetLine(geometry, lineOffset * pixelsToTileUnits);
    }
    return polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth);
  }

  isTileClipped() {
    return true;
  }
}

export default LineStyleLayer;

function getLineWidth(lineWidth, lineGapWidth) {
  if (lineGapWidth > 0) {
    return lineGapWidth + 2 * lineWidth;
  }
  return lineWidth;
}

function offsetLine(rings, offset) {
  const newRings = new Array(rings.length);
  for (let k = 0; k < rings.length; k++) {
    const ring = rings[k];
    const newRing = new Array(ring.length);
    newRings[k] = newRing;

    let b = ring[0];
    let aToB = new Point(0, 0);
    for (let i = 0; i < ring.length - 1; i++) {
      const c = ring[i + 1];
      const bToC = c.sub(b)._unit()._perp();
      const extrude = aToB._add(bToC)._unit();
      const cosHalfAngle = extrude.x * bToC.x + extrude.y * bToC.y;
      if (cosHalfAngle !== 0) {
        extrude._div(cosHalfAngle);
      }
      newRing[i] = extrude._mult(offset)._add(b);

      b = c;
      aToB = bToC;
    }

    newRing[ring.length - 1] = aToB._unit()._mult(offset)._add(b);
  }
  return newRings;
}
