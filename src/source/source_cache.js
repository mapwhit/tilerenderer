import { ErrorEvent, Event, Evented } from '@mapwhit/events';
import { Point } from '@mapwhit/point-geometry';
import EXTENT from '../data/extent.js';
import Coordinate from '../geo/coordinate.js';
import browser from '../util/browser.js';
import { create as createSource } from './source.js';
import SourceFeatureState from './source_state.js';
import Tile from './tile.js';
import TileCache from './tile_cache.js';
import { OverscaledTileID } from './tile_id.js';

/**
 * `SourceCache` is responsible for
 *
 *  - creating an instance of `Source`
 *  - forwarding events from `Source`
 *  - caching tiles loaded from an instance of `Source`
 *  - loading the tiles needed to render a given viewport
 *  - unloading the cached tiles not needed to render a given viewport
 *
 * @private
 */
class SourceCache extends Evented {
  // this.#sourceLoaded signifies that the TileJSON is loaded if applicable.
  // if the source type does not come with a TileJSON, the flag signifies the
  // source data has loaded (i.e geojson has been tiled on the worker and is ready)
  #sourceLoaded = false;
  #sourceErrored = false;
  #paused = false;
  #shouldReloadOnResume = false;

  constructor(id, options, workerOpts) {
    super();
    this.id = id;

    this.on('data', e => {
      if (e.dataType !== 'source') {
        return;
      }
      if (e.sourceDataType === 'metadata') {
        this.#sourceLoaded = true;
      }

      // for sources with mutable data, this event fires when the underlying data
      // to a source is changed. (i.e. GeoJSONSource#setData and ImageSource#serCoordinates)
      if (this.#sourceLoaded && !this.#paused && e.sourceDataType === 'content') {
        this.reload();
        if (this.transform) {
          this.update(this.transform);
        }
      }
    });

    this.on('error', () => (this.#sourceErrored = true));

    this._source = createSource(id, options, this, workerOpts);

    this._tiles = new Map();
    this._cache = new TileCache(0, this._unloadTile.bind(this));
    this._coveredTiles = new Set();
    this._state = new SourceFeatureState();
  }

  onAdd(map) {
    this.map = map;
    if (this._source?.onAdd) {
      this._source.onAdd(map);
    }
  }

  onRemove(map) {
    if (this._source?.onRemove) {
      this._source.onRemove(map);
    }
  }

  /**
   * Return `true` if no tile data is pending, tiles will not change unless
   * an additional API call is received.
   * If `ignoreTilesLoading` is set, return `true` even when tiles are pending,
   * otherwise there is no way to check that source is ready after loading style.
   * Without `ignoreTilesLoading` the state of style being loaded or not depends on
   * the tiles being in the process of loading or not.
   */
  loaded(ignoreTilesLoading) {
    if (this.#sourceErrored) {
      return true;
    }

    if (!this.#sourceLoaded) {
      return false;
    }

    if (ignoreTilesLoading) {
      return true;
    }
    for (const tile of this._tiles.values()) {
      if (tile.state !== 'loaded' && tile.state !== 'errored') {
        return false;
      }
    }
    return true;
  }

  getSource() {
    return this._source;
  }

  pause() {
    this.#paused = true;
  }

  resume() {
    if (!this.#paused) {
      return;
    }
    const shouldReload = this.#shouldReloadOnResume;
    this.#paused = false;
    this.#shouldReloadOnResume = false;
    if (shouldReload) {
      this.reload();
    }
    if (this.transform) {
      this.update(this.transform);
    }
  }

  _loadTile(tile) {
    return this._source.loadTile(tile);
  }

  _unloadTile(tile) {
    return this._source.unloadTile?.(tile);
  }

  _abortTile(tile) {
    return this._source.abortTile?.(tile);
  }

  prepare(context) {
    this._source.prepare?.();

    this._state.coalesceChanges(this._tiles.values(), this.map?.painter);
    this._tiles.forEach(tile => tile.upload(context));
  }

  /**
   * Return all tile ids ordered with z-order
   */
  getIds(filter = () => true) {
    const angle = this.transform?.angle ?? 0;

    return Array.from(this._tiles)
      .filter(it => filter.call(this, it[1]))
      .sort(compareKeyZoom)
      .map(it => it[0]);

    function compareKeyZoom([, a_], [, b_]) {
      const a = a_.tileID;
      const b = b_.tileID;
      const zDiff = a.overscaledZ - b.overscaledZ;
      if (zDiff !== 0) {
        return zDiff;
      }
      const rotatedA = new Point(a.canonical.x, a.canonical.y).rotate(angle);
      const rotatedB = new Point(b.canonical.x, b.canonical.y).rotate(angle);
      return rotatedB.y - rotatedA.y || rotatedB.x - rotatedA.x;
    }
  }

  getRenderableIds(symbolLayer) {
    const filter = symbolLayer ? this.#isTileRenderableForSymbols : this.#isTileRenderable;
    return this.getIds(filter);
  }

  hasRenderableParent(tileID) {
    const parentTile = this.findLoadedParent(tileID, 0);
    return this.#isTileRenderable(parentTile);
  }

  #isTileRenderable(tile) {
    return tile?.hasData() && !this._coveredTiles.has(tile.tileID.key) && !tile.holdingForFade();
  }

  #isTileRenderableForSymbols(tile) {
    return tile?.hasData() && !this._coveredTiles.has(tile.tileID.key);
  }

  reload() {
    if (this.#paused) {
      this.#shouldReloadOnResume = true;
      return;
    }

    this._cache.reset();

    this._tiles.forEach(tile => {
      if (tile.state !== 'errored') {
        this._reloadTile(tile, 'reloading');
      }
    });
  }

  _reloadTile(tile, state) {
    // The difference between "loading" tiles and "reloading" or "expired"
    // tiles is that "reloading"/"expired" tiles are "renderable".
    // Therefore, a "loading" tile cannot become a "reloading" tile without
    // first becoming a "loaded" tile.
    if (tile.state !== 'loading') {
      tile.state = state;
    }
    this._loadTile(tile).then(
      () => this._tileLoaded(tile),
      err => this._tileLoadError(tile, err)
    );
  }

  _tileLoadError(tile, err) {
    tile.state = 'errored';
    // ignore do nothing strategy
    if (err.doNothing) {
      return;
    }
    if (err.status !== 404) {
      this._source.fire(new ErrorEvent(err, { tile }));
    }
    // continue to try loading parent/children tiles if a tile doesn't exist (404)
    else {
      this.update(this.transform);
    }
  }

  _tileLoaded(tile, err) {
    tile.timeAdded = browser.now();
    if (this.getSource().type === 'raster-dem' && tile.dem) {
      this._backfillDEM(tile);
    }
    this._state.initializeTileState(tile, this.map ? this.map.painter : null);

    this._source.fire(new Event('data', { dataType: 'source', tile: tile, coord: tile.tileID }));
  }

  /**
   * For raster terrain source, backfill DEM to eliminate visible tile boundaries
   * @private
   */
  _backfillDEM(tile) {
    const renderables = this.getRenderableIds();
    for (let i = 0; i < renderables.length; i++) {
      const borderId = renderables[i];
      if (tile.neighboringTiles?.[borderId]) {
        const borderTile = this.getTileByID(borderId);
        fillBorder(tile, borderTile);
        fillBorder(borderTile, tile);
      }
    }

    function fillBorder(tile, borderTile) {
      tile.needsHillshadePrepare = true;
      let dx = borderTile.tileID.canonical.x - tile.tileID.canonical.x;
      const dy = borderTile.tileID.canonical.y - tile.tileID.canonical.y;
      const dim = 2 ** tile.tileID.canonical.z;
      const borderId = borderTile.tileID.key;
      if (dx === 0 && dy === 0) {
        return;
      }

      if (Math.abs(dy) > 1) {
        return;
      }
      if (Math.abs(dx) > 1) {
        // Adjust the delta coordinate for world wraparound.
        if (Math.abs(dx + dim) === 1) {
          dx += dim;
        } else if (Math.abs(dx - dim) === 1) {
          dx -= dim;
        }
      }
      if (!borderTile.dem || !tile.dem) {
        return;
      }
      tile.dem.backfillBorder(borderTile.dem, dx, dy);
      if (tile.neighboringTiles?.[borderId]) {
        tile.neighboringTiles[borderId].backfilled = true;
      }
    }
  }
  /**
   * Get a specific tile by TileID
   */
  getTile(tileID) {
    return this.getTileByID(tileID.key);
  }

  /**
   * Get a specific tile by id
   */
  getTileByID(id) {
    return this._tiles.get(+id);
  }

  /**
   * get the zoom level adjusted for the difference in map and source tilesizes
   */
  getZoom(transform) {
    return transform.zoom + transform.scaleZoom(transform.tileSize / this._source.tileSize);
  }

  /**
   * For a given set of tiles, retain children that are loaded and have a zoom
   * between `zoom` (exclusive) and `maxCoveringZoom` (inclusive)
   */
  _retainLoadedChildren(idealTiles, zoom, maxCoveringZoom, retain) {
    for (let [id, tile] of this._tiles) {
      // only consider renderable tiles up to maxCoveringZoom
      if (
        retain.has(id) ||
        !tile.hasData() ||
        tile.tileID.overscaledZ <= zoom ||
        tile.tileID.overscaledZ > maxCoveringZoom
      ) {
        continue;
      }

      // loop through parents and retain the topmost loaded one if found
      let topmostLoadedID = tile.tileID;
      while (tile && tile.tileID.overscaledZ > zoom + 1) {
        const parentID = tile.tileID.scaledTo(tile.tileID.overscaledZ - 1);

        tile = this._tiles.get(parentID.key);

        if (tile?.hasData()) {
          topmostLoadedID = parentID;
        }
      }

      // loop through ancestors of the topmost loaded child to see if there's one that needed it
      let tileID = topmostLoadedID;
      while (tileID.overscaledZ > zoom) {
        tileID = tileID.scaledTo(tileID.overscaledZ - 1);
        if (idealTiles.has(tileID.key)) {
          // found a parent that needed a loaded child; retain that child
          retain.set(topmostLoadedID.key, topmostLoadedID);
          break;
        }
      }
    }
  }

  /**
   * Find a loaded parent of the given tile (up to minCoveringZoom)
   */
  findLoadedParent(tileID, minCoveringZoom) {
    for (let z = tileID.overscaledZ - 1; z >= minCoveringZoom; z--) {
      const parent = tileID.scaledTo(z);
      if (!parent) {
        return;
      }
      const tile = this._tiles.get(parent.key);
      if (tile?.hasData()) {
        return tile;
      }
      const pp = this._cache.get(parent);
      if (pp) {
        return pp;
      }
    }
  }

  /**
   * Resizes the tile cache based on the current viewport's size.
   *
   * Larger viewports use more tiles and need larger caches. Larger viewports
   * are more likely to be found on devices with more memory and on pages where
   * the map is more important.
   */
  updateCacheSize(transform) {
    const widthInTiles = Math.ceil(transform.width / this._source.tileSize) + 1;
    const heightInTiles = Math.ceil(transform.height / this._source.tileSize) + 1;
    const approxTilesInView = widthInTiles * heightInTiles;
    const commonZoomRange = 5;

    const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
    this._cache.setMaxSize(viewDependentMaxSize);
  }

  handleWrapJump(lng) {
    // On top of the regular z/x/y values, TileIDs have a `wrap` value that specify
    // which cppy of the world the tile belongs to. For example, at `lng: 10` you
    // might render z/x/y/0 while at `lng: 370` you would render z/x/y/1.
    //
    // When lng values get wrapped (going from `lng: 370` to `long: 10`) you expect
    // to see the same thing on the screen (370 degrees and 10 degrees is the same
    // place in the world) but all the TileIDs will have different wrap values.
    //
    // In order to make this transition seamless, we calculate the rounded difference of
    // "worlds" between the last frame and the current frame. If the map panned by
    // a world, then we can assign all the tiles new TileIDs with updated wrap values.
    // For example, assign z/x/y/1 a new id: z/x/y/0. It is the same tile, just rendered
    // in a different position.
    //
    // This enables us to reuse the tiles at more ideal locations and prevent flickering.
    const prevLng = this._prevLng === undefined ? lng : this._prevLng;
    const lngDifference = lng - prevLng;
    const worldDifference = lngDifference / 360;
    const wrapDelta = Math.round(worldDifference);
    this._prevLng = lng;

    if (wrapDelta) {
      const tiles = new Map();
      for (const tile of this._tiles.values()) {
        tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
        tiles.set(tile.tileID.key, tile);
      }
      this._tiles = tiles;
    }
  }

  /**
   * Removes tiles that are outside the viewport and adds new tiles that
   * are inside the viewport.
   */
  update(transform) {
    this.transform = transform;
    if (!this.#sourceLoaded || this.#paused) {
      return;
    }

    this.updateCacheSize(transform);
    this.handleWrapJump(this.transform.center.lng);

    // Covered is a list of retained tiles who's areas are fully covered by other,
    // better, retained tiles. They are not drawn separately.
    this._coveredTiles.clear();

    let idealTileIDs;
    if (!this.used) {
      idealTileIDs = [];
    } else if (this._source.tileID) {
      idealTileIDs = transform
        .getVisibleUnwrappedCoordinates(this._source.tileID)
        .map(
          unwrapped =>
            new OverscaledTileID(
              unwrapped.canonical.z,
              unwrapped.wrap,
              unwrapped.canonical.z,
              unwrapped.canonical.x,
              unwrapped.canonical.y
            )
        );
    } else {
      idealTileIDs = transform.coveringTiles({
        tileSize: this._source.tileSize,
        minzoom: this._source.minzoom,
        maxzoom: this._source.maxzoom,
        roundZoom: this._source.roundZoom,
        reparseOverscaled: this._source.reparseOverscaled
      });

      if (this._source.hasTile) {
        idealTileIDs = idealTileIDs.filter(coord => this._source.hasTile(coord));
      }
    }

    // Determine the overzooming/underzooming amounts.
    const zoom = (this._source.roundZoom ? Math.round : Math.floor)(this.getZoom(transform));
    const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
    const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming, this._source.minzoom);

    // Retain is a list of tiles that we shouldn't delete, even if they are not
    // the most ideal tile for the current viewport. This may include tiles like
    // parent or child tiles that are *already* loaded.
    const retain = this._updateRetainedTiles(idealTileIDs, zoom);

    if (isRasterType(this._source.type)) {
      const parentsForFading = new Map();
      const fadingTiles = new Set();
      for (const [id, tileID] of retain) {
        const tile = this._tiles.get(id);
        if (!tile || (tile.fadeEndTime && tile.fadeEndTime <= browser.now())) {
          continue;
        }

        // if the tile is loaded but still fading in, find parents to cross-fade with it
        const parentTile = this.findLoadedParent(tileID, minCoveringZoom);
        if (parentTile) {
          this._addTile(parentTile.tileID);
          parentsForFading.set(parentTile.tileID.key, parentTile.tileID);
        }

        fadingTiles.add(id);
      }

      // for tiles that are still fading in, also find children to cross-fade with
      this._retainLoadedChildren(fadingTiles, zoom, maxCoveringZoom, retain);

      for (const [id, tileID] of parentsForFading) {
        if (!retain.has(id)) {
          // If a tile is only needed for fading, mark it as covered so that it isn't rendered on it's own.
          this._coveredTiles.add(id);
          retain.set(id, tileID);
        }
      }
    }

    for (const [retainedId] of retain) {
      // Make sure retained tiles always clear any existing fade holds
      // so that if they're removed again their fade timer starts fresh.
      this._tiles.get(retainedId).clearFadeHold();
    }

    // Remove the tiles we don't need anymore.
    for (const [id, tile] of this._tiles) {
      if (retain.has(id)) {
        continue;
      }
      if (tile.hasSymbolBuckets && !tile.holdingForFade()) {
        tile.setHoldDuration(this.map._fadeDuration);
      } else if (!tile.hasSymbolBuckets || tile.symbolFadeFinished()) {
        this._removeTile(id);
      }
    }
  }

  releaseSymbolFadeTiles() {
    for (const [id, tile] of this._tiles) {
      if (tile.holdingForFade()) {
        this._removeTile(id);
      }
    }
  }

  _updateRetainedTiles(idealTileIDs, zoom) {
    const retain = new Map();
    const checked = new Set();
    const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
    const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming, this._source.minzoom);

    const missingTiles = new Set();
    for (const tileID of idealTileIDs) {
      const tile = this._addTile(tileID);

      // retain the tile even if it's not loaded because it's an ideal tile.
      retain.set(tileID.key, tileID);

      if (tile.hasData()) {
        continue;
      }

      if (zoom < this._source.maxzoom) {
        // save missing tiles that potentially have loaded children
        missingTiles.add(tileID.key);
      }
    }

    // retain any loaded children of ideal tiles up to maxCoveringZoom
    this._retainLoadedChildren(missingTiles, zoom, maxCoveringZoom, retain);

    for (const tileID of idealTileIDs) {
      let tile = this._tiles.get(tileID.key);

      if (tile.hasData()) {
        continue;
      }

      // The tile we require is not yet loaded or does not exist;
      // Attempt to find children that fully cover it.

      if (zoom + 1 > this._source.maxzoom) {
        // We're looking for an overzoomed child tile.
        const childCoord = tileID.children(this._source.maxzoom)[0];
        const childTile = this.getTile(childCoord);
        if (!!childTile && childTile.hasData()) {
          retain.set(childCoord.key, childCoord);
          continue; // tile is covered by overzoomed child
        }
      } else {
        // check if all 4 immediate children are loaded (i.e. the missing ideal tile is covered)
        const children = tileID.children(this._source.maxzoom);

        if (
          retain.has(children[0].key) &&
          retain.has(children[1].key) &&
          retain.has(children[2].key) &&
          retain.has(children[3].key)
        ) {
          continue; // tile is covered by children
        }
      }

      // We couldn't find child tiles that entirely cover the ideal tile; look for parents now.

      // As we ascend up the tile pyramid of the ideal tile, we check whether the parent
      // tile has been previously requested (and errored because we only loop over tiles with no data)
      // in order to determine if we need to request its parent.
      let parentWasRequested = tile.wasRequested();

      for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
        const parentId = tileID.scaledTo(overscaledZ);

        // Break parent tile ascent if this route has been previously checked by another child.
        if (checked.has(parentId.key)) {
          break;
        }
        checked.add(parentId.key);

        tile = this.getTile(parentId);
        if (!tile && parentWasRequested) {
          tile = this._addTile(parentId);
        }
        if (tile) {
          retain.set(parentId.key, parentId);
          // Save the current values, since they're the parent of the next iteration
          // of the parent tile ascent loop.
          parentWasRequested = tile.wasRequested();
          if (tile.hasData()) {
            break;
          }
        }
      }
    }

    return retain;
  }

  /**
   * Add a tile, given its coordinate, to the pyramid.
   * @private
   */
  _addTile(tileID) {
    let tile = this._tiles.get(tileID.key);
    if (tile) {
      return tile;
    }

    tile = this._cache.getAndRemove(tileID);
    if (tile) {
      // set the tileID because the cached tile could have had a different wrap value
      tile.tileID = tileID;
      this._state.initializeTileState(tile, this.map?.painter);
    }

    const cached = Boolean(tile);
    if (!cached) {
      tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor());
      this._loadTile(tile).then(
        () => this._tileLoaded(tile),
        err => this._tileLoadError(tile, err)
      );
    }
    tile.uses++;
    this._tiles.set(tileID.key, tile);
    if (!cached) {
      this._source.fire(new Event('dataloading', { tile: tile, coord: tile.tileID, dataType: 'source' }));
    }

    return tile;
  }

  /**
   * Remove a tile, given its id, from the pyramid
   * @private
   */
  _removeTile(id) {
    const tile = this._tiles.get(id);
    if (!tile) {
      return;
    }

    tile.uses--;
    this._tiles.delete(id);

    if (tile.uses > 0) {
      return;
    }

    if (tile.hasData()) {
      this._cache.add(tile);
    } else {
      tile.aborted = true;
      this._abortTile(tile);
      this._unloadTile(tile);
    }
  }

  /**
   * Remove all tiles from this pyramid
   */
  clearTiles() {
    this.#shouldReloadOnResume = false;
    this.#paused = false;

    for (const id of this._tiles.keys()) {
      this._removeTile(id);
    }

    this._cache.reset();
  }

  /**
   * Search through our current tiles and attempt to find the tiles that
   * cover the given bounds.
   * @param pointQueryGeometry coordinates of the corners of bounding rectangle
   * @returns {Array<Object>} result items have {tile, minX, maxX, minY, maxY}, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
   */
  tilesIn(pointQueryGeometry, maxPitchScaleFactor, has3DLayer) {
    const tileResults = [];

    const transform = this.transform;
    if (!transform) {
      return tileResults;
    }

    const cameraPointQueryGeometry = has3DLayer
      ? transform.getCameraQueryGeometry(pointQueryGeometry)
      : pointQueryGeometry;

    const queryGeometry = pointQueryGeometry.map(p => transform.pointCoordinate(p));
    const cameraQueryGeometry = cameraPointQueryGeometry.map(p => transform.pointCoordinate(p));

    const ids = this.getIds();

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const z = queryGeometry[0].zoom;

    for (const p of cameraQueryGeometry) {
      minX = Math.min(minX, p.column);
      minY = Math.min(minY, p.row);
      maxX = Math.max(maxX, p.column);
      maxY = Math.max(maxY, p.row);
    }

    for (const id of ids) {
      const tile = this._tiles.get(id);
      if (tile.holdingForFade()) {
        // Tiles held for fading are covered by tiles that are closer to ideal
        continue;
      }
      const tileID = tile.tileID;
      const scale = 2 ** (transform.zoom - tile.tileID.overscaledZ);
      const queryPadding = (maxPitchScaleFactor * tile.queryPadding * EXTENT) / tile.tileSize / scale;

      const tileSpaceBounds = [
        coordinateToTilePoint(tileID, new Coordinate(minX, minY, z)),
        coordinateToTilePoint(tileID, new Coordinate(maxX, maxY, z))
      ];

      if (
        tileSpaceBounds[0].x - queryPadding < EXTENT &&
        tileSpaceBounds[0].y - queryPadding < EXTENT &&
        tileSpaceBounds[1].x + queryPadding >= 0 &&
        tileSpaceBounds[1].y + queryPadding >= 0
      ) {
        const tileSpaceQueryGeometry = queryGeometry.map(c => coordinateToTilePoint(tileID, c));
        const tileSpaceCameraQueryGeometry = cameraQueryGeometry.map(c => coordinateToTilePoint(tileID, c));

        tileResults.push({
          tile,
          tileID,
          queryGeometry: tileSpaceQueryGeometry,
          cameraQueryGeometry: tileSpaceCameraQueryGeometry,
          scale
        });
      }
    }

    return tileResults;
  }

  getVisibleCoordinates(symbolLayer) {
    const coords = this.getRenderableIds(symbolLayer).map(id => this._tiles.get(id).tileID);
    for (const coord of coords) {
      coord.posMatrix = this.transform.calculatePosMatrix(coord.toUnwrapped());
    }
    return coords;
  }

  hasTransition() {
    if (this._source.hasTransition()) {
      return true;
    }

    if (isRasterType(this._source.type)) {
      for (const tile of this._tiles.values()) {
        if (tile.fadeEndTime !== undefined && tile.fadeEndTime >= browser.now()) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Set the value of a particular state for a feature
   * @private
   */
  setFeatureState(sourceLayer, feature, state) {
    sourceLayer = sourceLayer || '_geojsonTileLayer';
    this._state.updateState(sourceLayer, feature, state);
  }

  /**
   * Resets the value of a particular state key for a feature
   * @private
   */
  removeFeatureState(sourceLayer, feature, key) {
    sourceLayer = sourceLayer || '_geojsonTileLayer';
    this._state.removeFeatureState(sourceLayer, feature, key);
  }

  /**
   * Get the entire state object for a feature
   * @private
   */
  getFeatureState(sourceLayer, feature) {
    sourceLayer = sourceLayer || '_geojsonTileLayer';
    return this._state.getState(sourceLayer, feature);
  }
}

SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;

/**
 * Convert a coordinate to a point in a tile's coordinate space.
 * @private
 */
function coordinateToTilePoint(tileID, coord) {
  const zoomedCoord = coord.zoomTo(tileID.canonical.z);
  return new Point(
    (zoomedCoord.column - (tileID.canonical.x + tileID.wrap * 2 ** tileID.canonical.z)) * EXTENT,
    (zoomedCoord.row - tileID.canonical.y) * EXTENT
  );
}

function isRasterType(type) {
  return type === 'raster' || type === 'image';
}

export default SourceCache;
