export function hasPattern(type, layers, options) {
  const patterns = options.patternDependencies;
  let hasPattern = false;

  for (const layer of layers) {
    const patternProperty = layer._paint.get(`${type}-pattern`);
    if (!patternProperty.isConstant()) {
      hasPattern = true;
    }

    const constantPattern = patternProperty.constantOr(null);
    if (constantPattern) {
      hasPattern = true;
      patterns[constantPattern.to] = true;
      patterns[constantPattern.from] = true;
    }
  }

  return hasPattern;
}

export function addPatternDependencies(type, layers, patternFeature, zoom, options) {
  const patterns = options.patternDependencies;
  for (const layer of layers) {
    const patternProperty = layer._paint.get(`${type}-pattern`);

    const patternPropertyValue = patternProperty.value;
    if (patternPropertyValue.kind !== 'constant') {
      const min = patternPropertyValue.evaluate({ zoom: zoom - 1 }, patternFeature, {});
      const mid = patternPropertyValue.evaluate({ zoom: zoom }, patternFeature, {});
      const max = patternPropertyValue.evaluate({ zoom: zoom + 1 }, patternFeature, {});
      // add to patternDependencies
      patterns[min] = true;
      patterns[mid] = true;
      patterns[max] = true;

      // save for layout
      patternFeature.patterns[layer.id] = { min, mid, max };
    }
  }
  return patternFeature;
}
