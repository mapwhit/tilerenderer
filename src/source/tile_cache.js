import assert from 'assert';

/**
 * A [fifo cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 */
class TileCache {
  #data = new Map();

  /**
   * @param {number} max number of permitted values
   * @param {Function} onRemove callback called with items when they expire
   */
  constructor(max, onRemove) {
    this.max = max;
    this.onRemove = onRemove;
  }

  /**
   * Clear the cache
   *
   * @returns {TileCache} this cache
   */
  reset() {
    for (const data of this.#data.values()) {
      this.onRemove(data);
    }
    this.#data.clear();
    return this;
  }

  /**
   * Add a key, value combination to the cache, trimming its size if this pushes
   * it over max length.
   *
   * @param {OverscaledTileID} tileID lookup key for the item
   * @param {*} data any value
   *
   * @returns {TileCache} this cache
   */
  add(data) {
    const key = data.tileID.cacheKey;
    assert(!this.#data.has(key));
    this.#data.set(key, data);
    if (this.#data.size > this.max) {
      const [[key, tile]] = this.#data;
      this.onRemove(tile);
      this.#data.delete(key);
    }

    return this;
  }

  /**
   * Determine whether the value attached to `key` is present
   *
   * @param {OverscaledTileID} tileID the key to be looked-up
   * @returns {boolean} whether the cache has this value
   */
  has(tileID) {
    return this.#data.has(tileID.cacheKey);
  }

  /**
   * Get the value attached to a specific key and remove data from cache.
   * If the key is not found, returns `null`
   *
   * @param {OverscaledTileID} tileID the key to look up
   * @returns {*} the data, or null if it isn't found
   */
  getAndRemove(tileID) {
    return this.#getAndRemoveByKey(tileID.cacheKey);
  }

  /*
   * Get and remove the value with the specified key.
   */
  #getAndRemoveByKey(key) {
    const tile = this.#data.get(key);
    if (tile) {
      this.#data.delete(key);
      return tile;
    }
  }

  /**
   * Get the value attached to a specific key without removing data
   * from the cache. If the key is not found, returns `null`
   *
   * @param {OverscaledTileID} tileID the key to look up
   * @returns {*} the data, or null if it isn't found
   */
  get(tileID) {
    return this.#data.get(tileID.cacheKey);
  }

  /**
   * Change the max size of the cache.
   *
   * @param {number} max the max size of the cache
   * @returns {TileCache} this cache
   */
  setMaxSize(max) {
    for (let overflow = this.#data.size - max; overflow > 0; overflow--) {
      const [[key, data]] = this.#data;
      this.onRemove(data);
      this.#data.delete(key);
    }

    this.max = max;
    return this;
  }

  get keys() {
    return Array.from(this.#data.keys());
  }

  get size() {
    return this.#data.size;
  }
}

export default TileCache;
