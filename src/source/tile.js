import { CollisionBoxArray, RasterBoundsArray } from '../data/array_types.js';
import { updateBuckets } from '../data/bucket.js';
import EXTENT from '../data/extent.js';
import { TriangleIndexArray } from '../data/index_array_type.js';
import rasterBoundsAttributes from '../data/raster_bounds_attributes.js';
import SegmentVector from '../data/segment.js';
import Texture from '../render/texture.js';
import EvaluationParameters from '../style/evaluation_parameters.js';
import featureFilter from '../style-spec/feature_filter/index.js';
import browser from '../util/browser.js';
import { deepEqual } from '../util/object.js';
import uniqueId from '../util/unique_id.js';
import GeoJSONFeature from '../util/vectortile_to_geojson.js';
import { lazyLoadRTLTextPlugin } from './rtl_text_plugin.js';

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @private
 */
class Tile {
  /**
   * @param {OverscaledTileID} tileID
   * @param size
   */
  constructor(tileID, size) {
    this.tileID = tileID;
    this.uid = uniqueId();
    this.uses = 0;
    this.tileSize = size;
    this.buckets = new Map();
    this.queryPadding = 0;
    this.hasSymbolBuckets = false;
    this.hasRTLText = false;

    this.state = 'loading';
  }

  registerFadeDuration(duration) {
    const fadeEndTime = duration + this.timeAdded;
    if (fadeEndTime < browser.now()) {
      return;
    }
    if (this.fadeEndTime && fadeEndTime < this.fadeEndTime) {
      return;
    }

    this.fadeEndTime = fadeEndTime;
  }

  wasRequested() {
    return this.state === 'errored' || this.state === 'loaded' || this.state === 'reloading';
  }

  /**
   * Given a data object with a 'buffers' property, load it into
   * this tile's elementGroups and buffers properties and set loaded
   * to true. If the data is null, like in the case of an empty
   * GeoJSON tile, no-op but still set loaded to true.
   * @param {Object} data
   * @param painter
   * @returns {undefined}
   */
  loadVectorData(data, painter) {
    if (this.hasData()) {
      this.unloadVectorData();
    }

    this.state = 'loaded';

    // empty GeoJSON tile
    if (!data) {
      this.collisionBoxArray = new CollisionBoxArray();
      return;
    }

    if (data.featureIndex) {
      this.latestFeatureIndex = data.featureIndex;
      if (data.vectorTile) {
        // Only vector tiles have `vectorTile`, and they won't update it for `reloadTile`
        this.latestVectorTile = data.vectorTile;
        this.latestFeatureIndex.vectorTile = data.vectorTile;
      } else if (this.latestVectorTile) {
        // If `vectorTile` hasn't updated, hold onto a pointer to the last one we received
        this.latestFeatureIndex.vectorTile = this.latestVectorTile;
      }
      if (data.rawTileData) {
        // rawTileData is present only in vector tiles and only in debug mode
        this.latestRawTileData = data.rawTileData;
      }
    }
    this.collisionBoxArray = data.collisionBoxArray;

    updateBuckets(data.buckets, painter.style);

    this.buckets = data.buckets;
    this.hasSymbolBuckets = data.hasSymbolBuckets;
    this.queryPadding = data.queryPadding;

    if (data.hasRTLText) {
      this.hasRTLText = data.hasRTLText;
      lazyLoadRTLTextPlugin();
    }
    if (data.imageAtlas) {
      this.imageAtlas = data.imageAtlas;
    }
    if (data.glyphAtlasImage) {
      this.glyphAtlasImage = data.glyphAtlasImage;
    }
  }

  /**
   * Release any data or WebGL resources referenced by this tile.
   * @returns {undefined}
   * @private
   */
  unloadVectorData() {
    if (this.state === 'unloaded') {
      return;
    }
    for (const bucket of this.buckets.values()) {
      bucket.destroy();
    }
    this.buckets.clear();

    this.imageAtlasTexture?.destroy();
    if (this.imageAtlas) {
      this.imageAtlas = null;
    }
    this.glyphAtlasTexture?.destroy();
    this.latestFeatureIndex = null;
    this.state = 'unloaded';
  }

  unloadDEMData() {
    this.dem = null;
    this.neighboringTiles = null;
    this.state = 'unloaded';
  }

  getBucket(layer) {
    return this.buckets.get(layer.id);
  }

  upload(context) {
    for (const bucket of this.buckets.values()) {
      if (bucket.uploadPending()) {
        bucket.upload(context);
      }
    }

    const gl = context.gl;

    if (this.imageAtlas && !this.imageAtlas.uploaded) {
      this.imageAtlasTexture = new Texture(context, this.imageAtlas.image, gl.RGBA);
      this.imageAtlas.uploaded = true;
    }

    if (this.glyphAtlasImage) {
      this.glyphAtlasTexture = new Texture(context, this.glyphAtlasImage, gl.ALPHA);
      this.glyphAtlasImage = null;
    }
  }

  // Queries non-symbol features rendered for this tile.
  // Symbol features are queried globally
  queryRenderedFeatures(
    layers,
    sourceFeatureState,
    queryGeometry,
    cameraQueryGeometry,
    scale,
    params,
    transform,
    maxPitchScaleFactor,
    pixelPosMatrix
  ) {
    if (!this.latestFeatureIndex?.vectorTile) {
      return {};
    }

    return this.latestFeatureIndex.query(
      {
        queryGeometry,
        cameraQueryGeometry,
        scale,
        tileSize: this.tileSize,
        pixelPosMatrix,
        transform,
        params,
        queryPadding: this.queryPadding * maxPitchScaleFactor
      },
      layers,
      sourceFeatureState
    );
  }

  querySourceFeatures(result, params) {
    const featureIndex = this.latestFeatureIndex;
    if (!featureIndex?.vectorTile) {
      return;
    }

    const vtLayers = featureIndex.loadVTLayers();

    const sourceLayer = params ? params.sourceLayer : '';
    const layer = vtLayers._geojsonTileLayer || vtLayers[sourceLayer];

    if (!layer) {
      return;
    }

    const filter = featureFilter(params?.filter, params?.globalState);
    const { z, x, y } = this.tileID.canonical;
    const coord = { z, x, y };

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      if (filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) {
        const id = featureIndex.getId(feature, sourceLayer);
        const geojsonFeature = new GeoJSONFeature(feature, z, x, y, id);
        geojsonFeature.tile = coord;
        result.push(geojsonFeature);
      }
    }
  }

  clearMask() {
    if (this.segments) {
      this.segments.destroy();
      delete this.segments;
    }
    if (this.maskedBoundsBuffer) {
      this.maskedBoundsBuffer.destroy();
      delete this.maskedBoundsBuffer;
    }
    if (this.maskedIndexBuffer) {
      this.maskedIndexBuffer.destroy();
      delete this.maskedIndexBuffer;
    }
  }

  setMask(mask, context) {
    // don't redo buffer work if the mask is the same;
    if (deepEqual(this.mask, mask)) {
      return;
    }

    this.mask = mask;
    this.clearMask();

    // We want to render the full tile, and keeping the segments/vertices/indices empty means
    // using the global shared buffers for covering the entire tile.
    if (deepEqual(mask, { 0: true })) {
      return;
    }

    const maskedBoundsArray = new RasterBoundsArray();
    const indexArray = new TriangleIndexArray();

    this.segments = new SegmentVector();
    // Create a new segment so that we will upload (empty) buffers even when there is nothing to
    // draw for this tile.
    this.segments.prepareSegment(0, maskedBoundsArray, indexArray);

    const maskArray = Object.keys(mask);
    for (let i = 0; i < maskArray.length; i++) {
      const maskCoord = mask[maskArray[i]];
      const vertexExtent = EXTENT >> maskCoord.z;
      const tlVertexX = maskCoord.x * vertexExtent;
      const tlVertexY = maskCoord.y * vertexExtent;
      const brVertexX = tlVertexX + vertexExtent;
      const brVertexY = tlVertexY + vertexExtent;

      const segment = this.segments.prepareSegment(4, maskedBoundsArray, indexArray);

      maskedBoundsArray.emplaceBack(tlVertexX, tlVertexY, tlVertexX, tlVertexY);
      maskedBoundsArray.emplaceBack(brVertexX, tlVertexY, brVertexX, tlVertexY);
      maskedBoundsArray.emplaceBack(tlVertexX, brVertexY, tlVertexX, brVertexY);
      maskedBoundsArray.emplaceBack(brVertexX, brVertexY, brVertexX, brVertexY);

      const offset = segment.vertexLength;
      // 0, 1, 2
      // 1, 2, 3
      indexArray.emplaceBack(offset, offset + 1, offset + 2);
      indexArray.emplaceBack(offset + 1, offset + 2, offset + 3);

      segment.vertexLength += 4;
      segment.primitiveLength += 2;
    }

    this.maskedBoundsBuffer = context.createVertexBuffer(maskedBoundsArray, rasterBoundsAttributes.members);
    this.maskedIndexBuffer = context.createIndexBuffer(indexArray);
  }

  hasData() {
    return this.state === 'loaded' || this.state === 'reloading';
  }

  patternsLoaded() {
    return this.imageAtlas && !!Object.keys(this.imageAtlas.patternPositions).length;
  }

  setFeatureState(states, painter) {
    if (!this.latestFeatureIndex?.vectorTile || Object.keys(states).length === 0) {
      return;
    }

    const vtLayers = this.latestFeatureIndex.loadVTLayers();

    for (const [id, bucket] of this.buckets) {
      // Buckets are grouped by common source-layer
      const sourceLayerId = bucket.layers[0]['sourceLayer'] || '_geojsonTileLayer';
      const sourceLayer = vtLayers[sourceLayerId];
      const sourceLayerStates = states[sourceLayerId];
      if (!sourceLayer || !sourceLayerStates || Object.keys(sourceLayerStates).length === 0) {
        continue;
      }

      bucket.update(sourceLayerStates, sourceLayer, this.imageAtlas?.patternPositions || {});
      if (painter?.style) {
        this.queryPadding = Math.max(this.queryPadding, painter.style.getLayer(id).queryRadius(bucket));
      }
    }
  }

  holdingForFade() {
    return this.symbolFadeHoldUntil !== undefined;
  }

  symbolFadeFinished() {
    return !this.symbolFadeHoldUntil || this.symbolFadeHoldUntil < browser.now();
  }

  clearFadeHold() {
    this.symbolFadeHoldUntil = undefined;
  }

  setHoldDuration(duration) {
    this.symbolFadeHoldUntil = browser.now() + duration;
  }
}

export default Tile;
