module.exports = function (features) {
  const leftIndex = new Map();
  const rightIndex = new Map();
  const mergedFeatures = [];
  let mergedIndex = 0;

  for (let k = 0; k < features.length; k++) {
    const { geometry, text } = features[k];

    if (!text) {
      add(k);
      continue;
    }

    const leftKey = getKey(text, geometry);
    const rightKey = getKey(text, geometry, true);

    if (rightIndex.has(leftKey) && leftIndex.has(rightKey) && rightIndex.get(leftKey) !== leftIndex.get(rightKey)) {
      // found lines with the same text adjacent to both ends of the current line, merge all three
      const j = mergeFromLeft(leftKey, rightKey, geometry);
      const i = mergeFromRight(leftKey, rightKey, mergedFeatures[j].geometry);

      leftIndex.delete(leftKey);
      rightIndex.delete(rightKey);

      rightIndex.set(getKey(text, mergedFeatures[i].geometry, true), i);
      mergedFeatures[j].geometry = null;
    } else if (rightIndex.has(leftKey)) {
      // found mergeable line adjacent to the start of the current line, merge
      mergeFromRight(leftKey, rightKey, geometry);
    } else if (leftIndex.has(rightKey)) {
      // found mergeable line adjacent to the end of the current line, merge
      mergeFromLeft(leftKey, rightKey, geometry);
    } else {
      // no adjacent lines, add as a new item
      add(k);
      leftIndex.set(leftKey, mergedIndex - 1);
      rightIndex.set(rightKey, mergedIndex - 1);
    }
  }

  return mergedFeatures.filter(f => f.geometry);

  function add(k) {
    mergedFeatures.push(features[k]);
    mergedIndex++;
  }

  function mergeFromRight(leftKey, rightKey, [geom]) {
    const i = rightIndex.get(leftKey);
    rightIndex.delete(leftKey);
    rightIndex.set(rightKey, i);

    const feature = mergedFeatures[i];
    feature.geometry[0].pop();
    feature.geometry[0].push(...geom);
    return i;
  }

  function mergeFromLeft(leftKey, rightKey, [geom]) {
    const i = leftIndex.get(rightKey);
    leftIndex.delete(rightKey);
    leftIndex.set(leftKey, i);

    const feature = mergedFeatures[i];
    feature.geometry[0].shift();
    feature.geometry[0].unshift(...geom);
    return i;
  }

  function getKey(text, [geom], onRight) {
    const { x, y } = geom.at(onRight ? -1 : 0);
    return `${text}:${x}:${y}`;
  }
};
