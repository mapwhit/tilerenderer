/**
 * The `Bucket` interface is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract interface. An implementation exists for each style layer type.
 * Create a bucket via the `StyleLayer#createBucket` method.
 *
 * The concrete bucket types, using layout options from the style layer,
 * transform feature geometries into vertex and index data for use by the
 * vertex shader.  They also (via `ProgramConfiguration`) use feature
 * properties and the zoom level to populate the attributes needed for
 * data-driven styling.
 *
 * Buckets are designed to be built when tile is loaded and then converted (uploaded)
 * to tune bucket's vertex, index, and attribute data for consumption by WebGL.
 *
 * @private
 */

// style may have changed between creating a bucket when tile was loaded and rendering it
export function updateBuckets(buckets, style) {
  if (!style._changed) {
    return;
  }
  // Guard against the case where the map's style has been set to null while
  // this bucket has been parsing.
  if (!style) {
    for (const bucket of buckets.values()) {
      bucket.destroy();
    }
    buckets.clear();
    return;
  }

  const updatedAlready = new Set();
  for (const [id, bucket] of buckets) {
    if (updatedAlready.has(id)) {
      continue;
    }
    updatedAlready.add(id);

    const layers = bucket.layers.map(({ id }) => style.getLayer(id)).filter(Boolean);

    if (layers.length === 0) {
      bucket.destroy();
      buckets.delete(id);
      continue;
    }

    // swap out the layers in the bucket with the current style layers
    bucket.layers = layers;
    if (bucket.stateDependentLayerIds?.length) {
      bucket.stateDependentLayers = layers.filter(layer => layer.isStateDependent());
    }
  }
}
