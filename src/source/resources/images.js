module.exports = images;

function images({ actor, mapId }) {
  const cache = new Map(); // id -> image
  const inProgress = new Map(); // id -> promise

  return {
    getImages
  };

  async function getImages({ icons }) {
    const missing = new Set();
    const result = {};
    for (const id of icons) {
      if (cache.has(id)) {
        const image = cache.get(id);
        if (image) {
          result[id] = image;
        }
      } else {
        missing.add(id);
      }
    }
    if (missing.size === 0) {
      // All images are already in the cache
      return result;
    }
    const active = new Set();
    const needed = [...missing];
    // Check if any of the missing images are already being fetched
    for (const id of missing) {
      if (inProgress.has(id)) {
        active.add(inProgress.get(id));
        missing.delete(id);
      }
    }
    if (missing.size > 0) {
      // Fetch the remaining images
      await fetchMissing([...missing]);
    }
    if (active.size > 0) {
      await Promise.all(active);
    }
    for (const id of needed) {
      const image = cache.get(id);
      if (image) {
        result[id] = image;
      }
    }
    return result;
  }

  async function fetchMissing(icons) {
    const promise = actor.send('getImages', { icons }, mapId);
    for (const id of icons) {
      inProgress.set(id, promise);
    }
    const result = await promise;
    // Add the fetched images to the cache
    for (const id of icons) {
      cache.set(id, result[id]);
    }
    // Remove the fetched images from the inProgress set
    for (const id of icons) {
      inProgress.delete(id);
    }
  }
}
