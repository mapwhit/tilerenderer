const EXTENT = require('../data/extent');

const { SymbolInstanceArray } = require('../data/array_types');

/*
    The CrossTileSymbolIndex generally works on the assumption that
    a conceptual "unique symbol" can be identified by the text of
    the label combined with the anchor point. The goal is to assign
    these conceptual "unique symbols" a shared crossTileID that can be
    used by Placement to keep fading opacity states consistent and to
    deduplicate labels.

    The CrossTileSymbolIndex indexes all the current symbol instances and
    their crossTileIDs. When a symbol bucket gets added or updated, the
    index assigns a crossTileID to each of it's symbol instances by either
    matching it with an existing id or assigning a new one.
*/

// Round anchor positions to roughly 4 pixel grid
const roundingFactor = 512 / EXTENT / 2;

class TileLayerIndex {
  constructor(tileID, symbolInstances, bucketInstanceId) {
    this.tileID = tileID;
    this.indexedSymbolInstances = {};
    this.bucketInstanceId = bucketInstanceId;

    for (let i = 0; i < symbolInstances.length; i++) {
      const symbolInstance = symbolInstances.get(i);
      const key = symbolInstance.key;
      if (!this.indexedSymbolInstances[key]) {
        this.indexedSymbolInstances[key] = [];
      }
      // This tile may have multiple symbol instances with the same key
      // Store each one along with its coordinates
      this.indexedSymbolInstances[key].push({
        crossTileID: symbolInstance.crossTileID,
        coord: this.getScaledCoordinates(symbolInstance, tileID)
      });
    }
  }

  // Converts the coordinates of the input symbol instance into coordinates that be can compared
  // against other symbols in this index. Coordinates are:
  // (1) world-based (so after conversion the source tile is irrelevant)
  // (2) converted to the z-scale of this TileLayerIndex
  // (3) down-sampled by "roundingFactor" from tile coordinate precision in order to be
  //     more tolerant of small differences between tiles.
  getScaledCoordinates(symbolInstance, childTileID) {
    const zDifference = childTileID.canonical.z - this.tileID.canonical.z;
    const scale = roundingFactor / 2 ** zDifference;
    return {
      x: Math.floor((childTileID.canonical.x * EXTENT + symbolInstance.anchorX) * scale),
      y: Math.floor((childTileID.canonical.y * EXTENT + symbolInstance.anchorY) * scale)
    };
  }

  findMatches(symbolInstances, newTileID, zoomCrossTileIDs) {
    const tolerance =
      this.tileID.canonical.z < newTileID.canonical.z ? 1 : 2 ** (this.tileID.canonical.z - newTileID.canonical.z);

    for (let i = 0; i < symbolInstances.length; i++) {
      const symbolInstance = symbolInstances.get(i);
      if (symbolInstance.crossTileID) {
        // already has a match, skip
        continue;
      }

      const indexedInstances = this.indexedSymbolInstances[symbolInstance.key];
      if (!indexedInstances) {
        // No symbol with this key in this bucket
        continue;
      }

      const scaledSymbolCoord = this.getScaledCoordinates(symbolInstance, newTileID);

      for (const thisTileSymbol of indexedInstances) {
        // Return any symbol with the same keys whose coordinates are within 1
        // grid unit. (with a 4px grid, this covers a 12px by 12px area)
        if (
          Math.abs(thisTileSymbol.coord.x - scaledSymbolCoord.x) <= tolerance &&
          Math.abs(thisTileSymbol.coord.y - scaledSymbolCoord.y) <= tolerance &&
          !zoomCrossTileIDs[thisTileSymbol.crossTileID]
        ) {
          // Once we've marked ourselves duplicate against this parent symbol,
          // don't let any other symbols at the same zoom level duplicate against
          // the same parent (see issue #5993)
          zoomCrossTileIDs[thisTileSymbol.crossTileID] = true;
          symbolInstance.crossTileID = thisTileSymbol.crossTileID;
          break;
        }
      }
    }
  }
}

class CrossTileIDs {
  constructor() {
    this.maxCrossTileID = 0;
  }
  generate() {
    return ++this.maxCrossTileID;
  }
}

class CrossTileSymbolLayerIndex {
  constructor() {
    this.indexes = {};
    this.usedCrossTileIDs = {};
    this.lng = 0;
  }

  /*
   * Sometimes when a user pans across the antimeridian the longitude value gets wrapped.
   * To prevent labels from flashing out and in we adjust the tileID values in the indexes
   * so that they match the new wrapped version of the map.
   */
  handleWrapJump(lng) {
    const wrapDelta = Math.round((lng - this.lng) / 360);
    if (wrapDelta !== 0) {
      for (const zoom in this.indexes) {
        const zoomIndexes = this.indexes[zoom];
        const newZoomIndex = {};
        for (const key in zoomIndexes) {
          // change the tileID's wrap and add it to a new index
          const index = zoomIndexes[key];
          index.tileID = index.tileID.unwrapTo(index.tileID.wrap + wrapDelta);
          newZoomIndex[index.tileID.key] = index;
        }
        this.indexes[zoom] = newZoomIndex;
      }
    }
    this.lng = lng;
  }

  addBucket(tileID, bucket, crossTileIDs) {
    if (this.indexes[tileID.overscaledZ] && this.indexes[tileID.overscaledZ][tileID.key]) {
      if (this.indexes[tileID.overscaledZ][tileID.key].bucketInstanceId === bucket.bucketInstanceId) {
        return false;
      }
      // We're replacing this bucket with an updated version
      // Remove the old bucket's "used crossTileIDs" now so that
      // the new bucket can claim them.
      // The old index entries themselves stick around until
      // 'removeStaleBuckets' is called.
      this.removeBucketCrossTileIDs(tileID.overscaledZ, this.indexes[tileID.overscaledZ][tileID.key]);
    }

    for (let i = 0; i < bucket.symbolInstances.length; i++) {
      const symbolInstance = bucket.symbolInstances.get(i);
      symbolInstance.crossTileID = 0;
    }

    if (!this.usedCrossTileIDs[tileID.overscaledZ]) {
      this.usedCrossTileIDs[tileID.overscaledZ] = {};
    }
    const zoomCrossTileIDs = this.usedCrossTileIDs[tileID.overscaledZ];

    for (const zoom in this.indexes) {
      const zoomIndexes = this.indexes[zoom];
      if (Number(zoom) > tileID.overscaledZ) {
        for (const id in zoomIndexes) {
          const childIndex = zoomIndexes[id];
          if (childIndex.tileID.isChildOf(tileID)) {
            childIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
          }
        }
      } else {
        const parentCoord = tileID.scaledTo(Number(zoom));
        const parentIndex = zoomIndexes[parentCoord.key];
        if (parentIndex) {
          parentIndex.findMatches(bucket.symbolInstances, tileID, zoomCrossTileIDs);
        }
      }
    }

    for (let i = 0; i < bucket.symbolInstances.length; i++) {
      const symbolInstance = bucket.symbolInstances.get(i);
      if (!symbolInstance.crossTileID) {
        // symbol did not match any known symbol, assign a new id
        symbolInstance.crossTileID = crossTileIDs.generate();
        zoomCrossTileIDs[symbolInstance.crossTileID] = true;
      }
    }

    if (this.indexes[tileID.overscaledZ] === undefined) {
      this.indexes[tileID.overscaledZ] = {};
    }
    this.indexes[tileID.overscaledZ][tileID.key] = new TileLayerIndex(
      tileID,
      bucket.symbolInstances,
      bucket.bucketInstanceId
    );

    return true;
  }

  removeBucketCrossTileIDs(zoom, removedBucket) {
    for (const key in removedBucket.indexedSymbolInstances) {
      for (const symbolInstance of removedBucket.indexedSymbolInstances[key]) {
        delete this.usedCrossTileIDs[zoom][symbolInstance.crossTileID];
      }
    }
  }

  removeStaleBuckets(currentIDs) {
    let tilesChanged = false;
    for (const z in this.indexes) {
      const zoomIndexes = this.indexes[z];
      for (const tileKey in zoomIndexes) {
        if (!currentIDs[zoomIndexes[tileKey].bucketInstanceId]) {
          this.removeBucketCrossTileIDs(z, zoomIndexes[tileKey]);
          delete zoomIndexes[tileKey];
          tilesChanged = true;
        }
      }
    }
    return tilesChanged;
  }
}

class CrossTileSymbolIndex {
  constructor() {
    this.layerIndexes = {};
    this.crossTileIDs = new CrossTileIDs();
    this.maxBucketInstanceId = 0;
    this.bucketsInCurrentPlacement = {};
  }

  addLayer(styleLayer, tiles, lng) {
    let layerIndex = this.layerIndexes[styleLayer.id];
    if (layerIndex === undefined) {
      layerIndex = this.layerIndexes[styleLayer.id] = new CrossTileSymbolLayerIndex();
    }

    let symbolBucketsChanged = false;
    const currentBucketIDs = {};

    layerIndex.handleWrapJump(lng);

    for (const tile of tiles) {
      const symbolBucket = tile.getBucket(styleLayer);
      if (!symbolBucket || styleLayer.id !== symbolBucket.layerIds[0]) continue;

      if (!symbolBucket.bucketInstanceId) {
        symbolBucket.bucketInstanceId = ++this.maxBucketInstanceId;
      }

      if (layerIndex.addBucket(tile.tileID, symbolBucket, this.crossTileIDs)) {
        symbolBucketsChanged = true;
      }
      currentBucketIDs[symbolBucket.bucketInstanceId] = true;
    }

    if (layerIndex.removeStaleBuckets(currentBucketIDs)) {
      symbolBucketsChanged = true;
    }

    return symbolBucketsChanged;
  }

  pruneUnusedLayers(usedLayers) {
    const usedLayerMap = {};
    usedLayers.forEach(usedLayer => {
      usedLayerMap[usedLayer] = true;
    });
    for (const layerId in this.layerIndexes) {
      if (!usedLayerMap[layerId]) {
        delete this.layerIndexes[layerId];
      }
    }
  }
}

module.exports = CrossTileSymbolIndex;
