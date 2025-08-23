import { Placement } from '../symbol/placement.js';
import browser from '../util/browser.js';

class LayerPlacement {
  constructor() {
    this._currentTileIndex = 0;
    this._seenCrossTileIDs = {};
  }

  continuePlacement(tiles, placement, showCollisionBoxes, styleLayer, shouldPausePlacement) {
    while (this._currentTileIndex < tiles.length) {
      const tile = tiles[this._currentTileIndex];
      placement.placeLayerTile(styleLayer, tile, showCollisionBoxes, this._seenCrossTileIDs);

      this._currentTileIndex++;
      if (shouldPausePlacement()) {
        return true;
      }
    }
  }
}

class PauseablePlacement {
  constructor(transform, maxIndex, forceFullPlacement, showCollisionBoxes, fadeDuration, crossSourceCollisions) {
    this.placement = new Placement(transform, fadeDuration, crossSourceCollisions);
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
          this._inProgressLayer = new LayerPlacement();
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

  commit(previousPlacement, now) {
    this.placement.commit(previousPlacement, now);
    return this.placement;
  }
}

export default PauseablePlacement;
