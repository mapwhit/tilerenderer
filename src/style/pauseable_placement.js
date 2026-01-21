import { Placement } from '../symbol/placement.js';
import browser from '../util/browser.js';

class LayerPlacement {
  constructor(styleLayer) {
    this._sortAcrossTiles =
      styleLayer._layout.get('symbol-z-order') !== 'viewport-y' &&
      styleLayer._layout.get('symbol-sort-key').constantOr(1) !== undefined;

    this._currentTileIndex = 0;
    this._currentPartIndex = 0;
    this._seenCrossTileIDs = {};
    this._bucketParts = [];
  }

  continuePlacement(tiles, placement, showCollisionBoxes, styleLayer, shouldPausePlacement) {
    const bucketParts = this._bucketParts;

    while (this._currentTileIndex < tiles.length) {
      const tile = tiles[this._currentTileIndex];
      placement.getBucketParts(bucketParts, styleLayer, tile, this._sortAcrossTiles);

      this._currentTileIndex++;
      if (shouldPausePlacement()) {
        return true;
      }
    }

    if (this._sortAcrossTiles) {
      this._sortAcrossTiles = false;
      bucketParts.sort((a, b) => a.sortKey - b.sortKey);
    }

    while (this._currentPartIndex < bucketParts.length) {
      const bucketPart = bucketParts[this._currentPartIndex];
      placement.placeLayerBucketPart(bucketPart, this._seenCrossTileIDs, showCollisionBoxes);

      this._currentPartIndex++;
      if (shouldPausePlacement()) {
        return true;
      }
    }
    return false;
  }
}

class PauseablePlacement {
  constructor(
    transform,
    maxIndex,
    forceFullPlacement,
    showCollisionBoxes,
    fadeDuration,
    crossSourceCollisions,
    prevPlacement
  ) {
    this.placement = new Placement(transform, fadeDuration, crossSourceCollisions, prevPlacement);
    this._currentPlacementIndex = maxIndex;
    this._forceFullPlacement = forceFullPlacement;
    this._showCollisionBoxes = showCollisionBoxes;
    this._done = false;
  }

  isDone() {
    return this._done;
  }

  continuePlacement(layers, layerTiles) {
    const startTime = browser.now();

    const shouldPausePlacement = () => {
      const elapsedTime = browser.now() - startTime;
      return this._forceFullPlacement ? false : elapsedTime > 2;
    };

    while (this._currentPlacementIndex >= 0) {
      const layer = layers[this._currentPlacementIndex];
      const placementZoom = this.placement.collisionIndex.transform.zoom;
      if (
        layer.type === 'symbol' &&
        (!layer.minzoom || layer.minzoom <= placementZoom) &&
        (!layer.maxzoom || layer.maxzoom > placementZoom)
      ) {
        if (!this._inProgressLayer) {
          this._inProgressLayer = new LayerPlacement(layer);
        }

        const pausePlacement = this._inProgressLayer.continuePlacement(
          layerTiles[layer.source],
          this.placement,
          this._showCollisionBoxes,
          layer,
          shouldPausePlacement
        );

        if (pausePlacement) {
          // We didn't finish placing all layers within 2ms,
          // but we can keep rendering with a partial placement
          // We'll resume here on the next frame
          return;
        }

        delete this._inProgressLayer;
      }

      this._currentPlacementIndex--;
    }

    this._done = true;
  }

  commit(now) {
    this.placement.commit(now);
    return this.placement;
  }
}

export default PauseablePlacement;
