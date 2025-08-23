import groupBySource from '../util/group_layers.js';

class StyleLayerIndex {
  #layers = new Map();
  #fbs = {};

  constructor(layers) {
    if (layers) {
      this.replace(layers);
    }
  }

  replace(layers) {
    this.#layers = layers;
    this.#fbs = null;
  }

  update() {
    this.#fbs = null;
  }

  get familiesBySource() {
    if (!this.#fbs) {
      this.#fbs = groupBySource(this.#layers.values());
    }
    return this.#fbs;
  }
}

export default StyleLayerIndex;
