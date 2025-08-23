class GlyphManager {
  #cache = {};

  setGlyphsLoader(loader) {
    this.loader = loader;
  }

  async loadGlyphRange(stack, range) {
    this.#cache[stack] ??= {};
    const promise = (this.#cache[stack][range] ??= this.loader(stack, range));
    return await promise;
  }
}

export default GlyphManager;
