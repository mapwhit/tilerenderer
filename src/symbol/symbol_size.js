import { normalizePropertyExpression } from '@mapwhit/style-expressions';
import EvaluationParameters from '../style/evaluation_parameters.js';
import interpolate from '../util/interpolate.js';
import { clamp } from '../util/util.js';

// For {text,icon}-size, get the bucket-level data that will be needed by
// the painter to set symbol-size-related uniforms
export function getSizeData(tileZoom, value) {
  const { expression } = value;
  switch (expression.kind) {
    case 'constant':
      return {
        functionType: 'constant',
        layoutSize: expression.evaluate(new EvaluationParameters(tileZoom + 1))
      };
    case 'source':
      return {
        functionType: 'source'
      };
    case 'composite': {
      // We'd like to be able to use CameraExpression or CompositeExpression in these
      // return types rather than ExpressionSpecification, but the former are not
      // transferrable across Web Worker boundaries.
      return {
        functionType: 'composite',
        zoomRange: calculateZoomRange(expression.zoomStops, tileZoom),
        propertyValue: value.value
      };
    }
    default: {
      // for camera functions, also save off the function values
      // evaluated at the covering zoom levels
      const zoomRange = calculateZoomRange(expression.zoomStops, tileZoom);

      return {
        functionType: 'camera',
        layoutSize: expression.evaluate(new EvaluationParameters(tileZoom + 1)),
        zoomRange,
        sizeRange: {
          min: expression.evaluate(new EvaluationParameters(zoomRange.min)),
          max: expression.evaluate(new EvaluationParameters(zoomRange.max))
        },
        propertyValue: value.value
      };
    }
  }
}

// calculate covering zoom stops for zoom-dependent values
function calculateZoomRange(levels, tileZoom) {
  let lower = 0;
  while (lower < levels.length && levels[lower] <= tileZoom) {
    lower++;
  }
  lower = Math.max(0, lower - 1);
  let upper = lower;
  while (upper < levels.length && levels[upper] < tileZoom + 1) {
    upper++;
  }
  upper = Math.min(levels.length - 1, upper);

  return {
    min: levels[lower],
    max: levels[upper]
  };
}

export function evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol) {
  const part = partiallyEvaluatedSize;
  if (sizeData.functionType === 'source') {
    return symbol.lowerSize / 10;
  }
  if (sizeData.functionType === 'composite') {
    return interpolate(symbol.lowerSize / 10, symbol.upperSize / 10, part.uSizeT);
  }
  return part.uSize;
}

export function evaluateSizeForZoom(sizeData, currentZoom, property) {
  switch (sizeData.functionType) {
    case 'constant':
      return {
        uSizeT: 0,
        uSize: sizeData.layoutSize
      };
    case 'source':
      return {
        uSizeT: 0,
        uSize: 0
      };
    case 'camera': {
      const { propertyValue, zoomRange, sizeRange } = sizeData;
      const expression = normalizePropertyExpression(propertyValue, property.specification);

      // Even though we could get the exact value of the camera function
      // at z = tr.zoom, we intentionally do not: instead, we interpolate
      // between the camera function values at a pair of zoom stops covering
      // [tileZoom, tileZoom + 1] in order to be consistent with this
      // restriction on composite functions
      const t = clamp(expression.interpolationFactor(currentZoom, zoomRange.min, zoomRange.max), 0, 1);

      return {
        uSizeT: 0,
        uSize: sizeRange.min + t * (sizeRange.max - sizeRange.min)
      };
    }
    default: {
      const { propertyValue, zoomRange } = sizeData;
      const expression = normalizePropertyExpression(propertyValue, property.specification);

      return {
        uSizeT: clamp(expression.interpolationFactor(currentZoom, zoomRange.min, zoomRange.max), 0, 1),
        uSize: 0
      };
    }
  }
}
