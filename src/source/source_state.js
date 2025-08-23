/**
 * SourceFeatureState manages the state and pending changes
 * to features in a source, separated by source layer.
 * stateChanges and deletedStates batch all changes to the tile (updates and removes, respectively)
 * between coalesce() events. addFeatureState() and removeFeatureState() also update their counterpart's
 * list of changes, such that coalesce() can apply the proper state changes while agnostic to the order of operations.
 * In deletedStates, all null's denote complete removal of state at that scope
 *
 * @private
 */
class SourceFeatureState {
  #state = {};
  #stateChanges = {};
  #deletedStates = {};

  updateState(sourceLayer, feature, newState) {
    const changes = (this.#stateChanges[sourceLayer] ??= {});
    const featureState = (changes[feature] ??= {});
    Object.assign(featureState, newState);

    if (this.#deletedStates[sourceLayer] === null) {
      this.#deletedStates[sourceLayer] = {};
      for (const ft in this.#state[sourceLayer]) {
        if (ft !== feature) this.#deletedStates[sourceLayer][ft] = null;
      }
    } else {
      const featureDeletionQueued =
        this.#deletedStates[sourceLayer] && this.#deletedStates[sourceLayer][feature] === null;
      if (featureDeletionQueued) {
        this.#deletedStates[sourceLayer][feature] = {};
        for (const prop in this.state[sourceLayer][feature]) {
          if (!newState[prop]) this.#deletedStates[sourceLayer][feature][prop] = null;
        }
      } else {
        for (const key in newState) {
          const deletionInQueue = this.#deletedStates[sourceLayer]?.[feature]?.[key] === null;
          if (deletionInQueue) delete this.#deletedStates[sourceLayer][feature][key];
        }
      }
    }
  }

  removeFeatureState(sourceLayer, featureId, key) {
    const sourceLayerDeleted = this.#deletedStates[sourceLayer] === null;
    if (sourceLayerDeleted) return;

    const feature = String(featureId);

    this.#deletedStates[sourceLayer] = this.#deletedStates[sourceLayer] || {};

    if (key && featureId !== undefined) {
      if (this.#deletedStates[sourceLayer][feature] !== null) {
        this.#deletedStates[sourceLayer][feature] = this.#deletedStates[sourceLayer][feature] || {};
        this.#deletedStates[sourceLayer][feature][key] = null;
      }
    } else if (featureId !== undefined) {
      const updateInQueue = this.#stateChanges[sourceLayer]?.[feature];
      if (updateInQueue) {
        this.#deletedStates[sourceLayer][feature] = {};
        for (key in this.#stateChanges[sourceLayer][feature]) this.#deletedStates[sourceLayer][feature][key] = null;
      } else {
        this.#deletedStates[sourceLayer][feature] = null;
      }
    } else {
      this.#deletedStates[sourceLayer] = null;
    }
  }

  getState(sourceLayer, feature) {
    const base = this.#state[sourceLayer];
    const changes = this.#stateChanges[sourceLayer];
    const reconciledState = Object.assign({}, base?.[feature], changes?.[feature]);

    //return empty object if the whole source layer is awaiting deletion
    if (this.#deletedStates[sourceLayer] === null) return {};
    if (this.#deletedStates[sourceLayer]) {
      const featureDeletions = this.#deletedStates[sourceLayer][feature];
      if (featureDeletions === null) return {};
      for (const prop in featureDeletions) delete reconciledState[prop];
    }
    return reconciledState;
  }

  initializeTileState(tile, painter) {
    tile.setFeatureState(this.#state, painter);
  }

  coalesceChanges(tiles, painter) {
    //track changes with full state objects, but only for features that got modified
    const featuresChanged = {};
    for (const sourceLayer in this.#stateChanges) {
      this.#state[sourceLayer] ??= {};
      const layerStates = {};
      for (const feature in this.#stateChanges[sourceLayer]) {
        if (!this.#state[sourceLayer][feature]) this.#state[sourceLayer][feature] = {};
        Object.assign(this.#state[sourceLayer][feature], this.#stateChanges[sourceLayer][feature]);
        layerStates[feature] = this.#state[sourceLayer][feature];
      }
      featuresChanged[sourceLayer] = layerStates;
    }
    for (const sourceLayer in this.#deletedStates) {
      this.#state[sourceLayer] = this.#state[sourceLayer] || {};
      const layerStates = {};

      if (this.#deletedStates[sourceLayer] === null) {
        for (const ft in this.#state[sourceLayer]) layerStates[ft] = {};
        this.#state[sourceLayer] = {};
      } else {
        for (const feature in this.#deletedStates[sourceLayer]) {
          const deleteWholeFeatureState = this.#deletedStates[sourceLayer][feature] === null;
          if (deleteWholeFeatureState) this.#state[sourceLayer][feature] = {};
          else {
            for (const key of Object.keys(this.#deletedStates[sourceLayer][feature])) {
              delete this.#state[sourceLayer][feature][key];
            }
          }
          layerStates[feature] = this.#state[sourceLayer][feature];
        }
      }

      featuresChanged[sourceLayer] = featuresChanged[sourceLayer] || {};
      Object.assign(featuresChanged[sourceLayer], layerStates);
    }
    this.#stateChanges = {};
    this.#deletedStates = {};

    if (Object.keys(featuresChanged).length === 0) return;

    for (const tile of tiles) {
      tile.setFeatureState(featuresChanged, painter);
    }
  }
}

module.exports = SourceFeatureState;
