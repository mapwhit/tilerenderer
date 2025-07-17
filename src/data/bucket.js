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
 * Buckets are designed to be built on a worker thread and then serialized and
 * transferred back to the main thread for rendering.  On the worker side, a
 * bucket's vertex, index, and attribute data is stored in `bucket.arrays:
 * ArrayGroup`.  When a bucket's data is serialized and sent back to the main
 * thread, is gets deserialized (using `new Bucket(serializedBucketData)`, with
 * the array data now stored in `bucket.buffers: BufferGroup`.  BufferGroups
 * hold the same data as ArrayGroups, but are tuned for consumption by WebGL.
 *
 * @private
 */

function deserialize(input, style) {
  const output = new Map();

  // Guard against the case where the map's style has been set to null while
  // this bucket has been parsing.
  if (!style) return output;

  for (const bucket of input) {
    const layers = bucket.layerIds.map(id => style.getLayer(id)).filter(Boolean);

    if (layers.length === 0) {
      continue;
    }

    // look up StyleLayer objects from layer ids (since we don't
    // want to waste time serializing/copying them from the worker)
    bucket.layers = layers;
    bucket.stateDependentLayers = layers.filter(l => l.isStateDependent());
    for (const layer of layers) {
      output.set(layer.id, bucket);
    }
  }

  return output;
}

module.exports = {
  deserialize
};
