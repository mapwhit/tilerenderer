/**
 * SourceFeatureState manages the state and state changes
 * to features in a source, separated by source layer.
 *
 * @private
 */
class SourceFeatureState {
  #state = {};
  #stateChanges = {};

  updateState(sourceLayer, feature, state) {
    const changes = (this.#stateChanges[sourceLayer] ??= {});
    const featureState = (changes[feature] ??= {});
    Object.assign(featureState, state);
  }

  getState(sourceLayer, feature) {
    const base = this.#state[sourceLayer];
    const changes = this.#stateChanges[sourceLayer];
    return Object.assign({}, base?.[feature], changes?.[feature]);
  }

  initializeTileState(tile, painter) {
    tile.setFeatureState(this.#state, painter);
  }

  coalesceChanges(tiles, painter) {
    const changes = {};
    for (const sourceLayer in this.#stateChanges) {
      this.#state[sourceLayer] ??= {};
      const layerStates = {};
      for (const id in this.#stateChanges[sourceLayer]) {
        this.#state[sourceLayer][id] ??= {};
        Object.assign(this.#state[sourceLayer][id], this.#stateChanges[sourceLayer][id]);
        layerStates[id] = this.#state[sourceLayer][id];
      }
      changes[sourceLayer] = layerStates;
    }
    this.#stateChanges = {};
    if (Object.keys(changes).length === 0) return;

    Object.values(tiles).forEach(tile => tile.setFeatureState(changes, painter));
  }
}

module.exports = SourceFeatureState;
