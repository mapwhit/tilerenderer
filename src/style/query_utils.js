import { Point } from '@mapwhit/point-geometry';

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
