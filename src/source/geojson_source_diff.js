function getFeatureId(feature, promoteId) {
  return promoteId ? feature.properties[promoteId] : feature.id;
}
export function isUpdateableGeoJSON(data, promoteId) {
  // null can be updated
  if (data == null) {
    return true;
  }
  // {} can be updated
  if (data.type == null) {
    return true;
  }
  // a single feature with an id can be updated, need to explicitly check against null because 0 is a valid feature id that is falsy
  if (data.type === 'Feature') {
    return getFeatureId(data, promoteId) != null;
  }
  // a feature collection can be updated if every feature has an id, and the ids are all unique
  // this prevents us from silently dropping features if ids get reused
  if (data.type === 'FeatureCollection') {
    const seenIds = new Set();
    for (const feature of data.features) {
      const id = getFeatureId(feature, promoteId);
      if (id == null) {
        return false;
      }
      if (seenIds.has(id)) {
        return false;
      }
      seenIds.add(id);
    }
    return true;
  }
  return false;
}
export function toUpdateable(data, promoteId) {
  const result = new Map();
  if (data == null || data.type == null) {
    // empty result
  } else if (data.type === 'Feature') {
    result.set(getFeatureId(data, promoteId), data);
  } else {
    for (const feature of data.features) {
      result.set(getFeatureId(feature, promoteId), feature);
    }
  }
  return result;
}
// mutates updateable
export function applySourceDiff(updateable, diff, promoteId) {
  if (diff.removeAll) {
    updateable.clear();
  }
  if (diff.remove) {
    for (const id of diff.remove) {
      updateable.delete(id);
    }
  }
  if (diff.add) {
    for (const feature of diff.add) {
      const id = getFeatureId(feature, promoteId);
      if (id != null) {
        updateable.set(id, feature);
      }
    }
  }
  if (diff.update) {
    for (const update of diff.update) {
      let feature = updateable.get(update.id);
      if (feature == null) {
        continue;
      }
      // be careful to clone the feature and/or properties objects to avoid mutating our input
      const cloneFeature = update.newGeometry || update.removeAllProperties;
      // note: removeAllProperties gives us a new properties object, so we can skip the clone step
      const cloneProperties =
        !update.removeAllProperties &&
        (update.removeProperties?.length > 0 || update.addOrUpdateProperties?.length > 0);
      if (cloneFeature || cloneProperties) {
        feature = { ...feature };
        updateable.set(update.id, feature);
        if (cloneProperties) {
          feature.properties = { ...feature.properties };
        }
      }
      if (update.newGeometry) {
        feature.geometry = update.newGeometry;
      }
      if (update.removeAllProperties) {
        feature.properties = {};
      } else if (update.removeProperties?.length > 0) {
        for (const prop of update.removeProperties) {
          if (Object.prototype.hasOwnProperty.call(feature.properties, prop)) {
            delete feature.properties[prop];
          }
        }
      }
      if (update.addOrUpdateProperties?.length > 0) {
        for (const { key, value } of update.addOrUpdateProperties) {
          feature.properties[key] = value;
        }
      }
    }
  }
}
export function mergeSourceDiffs(existingDiff, newDiff) {
  if (!existingDiff) {
    return newDiff ?? {};
  }
  if (!newDiff) {
    return existingDiff;
  }
  const merged = { ...existingDiff };
  if (newDiff.removeAll) {
    merged.removeAll = true;
  }
  if (newDiff.remove) {
    const removedSet = new Set(merged.remove ? merged.remove.concat(newDiff.remove) : newDiff.remove);
    merged.remove = Array.from(removedSet.values());
  }
  if (newDiff.add) {
    const combinedAdd = merged.add ? merged.add.concat(newDiff.add) : newDiff.add;
    const addMap = new Map(combinedAdd.map(feature => [feature.id, feature]));
    merged.add = Array.from(addMap.values());
  }
  if (newDiff.update) {
    const updateMap = new Map(merged.update?.map(feature => [feature.id, feature]));
    for (const feature of newDiff.update) {
      const featureUpdate = updateMap.get(feature.id) ?? { id: feature.id };
      if (feature.newGeometry) {
        featureUpdate.newGeometry = feature.newGeometry;
      }
      if (feature.addOrUpdateProperties) {
        featureUpdate.addOrUpdateProperties = (featureUpdate.addOrUpdateProperties ?? []).concat(
          feature.addOrUpdateProperties
        );
      }
      if (feature.removeProperties) {
        featureUpdate.removeProperties = (featureUpdate.removeProperties ?? []).concat(feature.removeProperties);
      }
      if (feature.removeAllProperties) {
        featureUpdate.removeAllProperties = true;
      }
      updateMap.set(feature.id, featureUpdate);
    }
    merged.update = Array.from(updateMap.values());
  }
  return merged;
}
