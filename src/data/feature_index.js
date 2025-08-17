const loadGeometry = require('./load_geometry');
const EXTENT = require('./extent');
const featureFilter = require('../style-spec/feature_filter');
const Grid = require('grid-index');
const dictionaryCoder = require('../util/dictionary_coder');
const vt = require('@mapwhit/vector-tile');
const Protobuf = require('@mapwhit/pbf');
const GeoJSONFeature = require('../util/vectortile_to_geojson');
const { arraysIntersect } = require('../util/object');
const EvaluationParameters = require('../style/evaluation_parameters');
const { polygonIntersectsBox } = require('../util/intersection_tests');

const { FeatureIndexArray } = require('./array_types');

class FeatureIndex {
  constructor(tileID, grid = new Grid(EXTENT, 16, 0), featureIndexArray = new FeatureIndexArray()) {
    this.tileID = tileID;
    this.grid = grid;
    this.grid3D = new Grid(EXTENT, 16, 0);
    this.featureIndexArray = featureIndexArray;
  }

  insert(feature, geometry, featureIndex, sourceLayerIndex, bucketIndex, is3D) {
    const key = this.featureIndexArray.length;
    this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex);

    const grid = is3D ? this.grid3D : this.grid;

    for (const ring of geometry) {
      const { minX, minY, maxX, maxY } = getBounds(ring);
      if (minX < EXTENT && minY < EXTENT && maxX >= 0 && maxY >= 0) {
        grid.insert(key, minX, minY, maxX, maxY);
      }
    }
  }

  loadVTLayers() {
    if (!this.vtLayers) {
      this.vtLayers = new vt.VectorTile(new Protobuf(this.rawTileData)).layers;
      this.sourceLayerCoder = dictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers) : ['_geojsonTileLayer']);
    }
    return this.vtLayers;
  }

  // Finds non-symbol features in this tile at a particular position.
  query(args, styleLayers, sourceFeatureState) {
    this.loadVTLayers();

    const params = args.params || {};
    const pixelsToTileUnits = EXTENT / args.tileSize / args.scale;
    const filter = featureFilter(params.filter);

    const queryGeometry = args.queryGeometry;
    const queryPadding = args.queryPadding * pixelsToTileUnits;

    const bounds = getBounds(queryGeometry);
    const matching = this.grid.query(
      bounds.minX - queryPadding,
      bounds.minY - queryPadding,
      bounds.maxX + queryPadding,
      bounds.maxY + queryPadding
    );

    const cameraBounds = getBounds(args.cameraQueryGeometry);
    const matching3D = this.grid3D.query(
      cameraBounds.minX - queryPadding,
      cameraBounds.minY - queryPadding,
      cameraBounds.maxX + queryPadding,
      cameraBounds.maxY + queryPadding,
      (bx1, by1, bx2, by2) => {
        return polygonIntersectsBox(
          args.cameraQueryGeometry,
          bx1 - queryPadding,
          by1 - queryPadding,
          bx2 + queryPadding,
          by2 + queryPadding
        );
      }
    );

    matching.push(...matching3D);
    matching.sort(topDownFeatureComparator);

    const result = {};
    let previousIndex;
    for (let k = 0; k < matching.length; k++) {
      const index = matching[k];

      // don't check the same feature more than once
      if (index === previousIndex) continue;
      previousIndex = index;

      const match = this.featureIndexArray.get(index);
      let featureGeometry = null;
      const intersectionTest = (feature, styleLayer) => {
        if (!featureGeometry) {
          featureGeometry = loadGeometry(feature);
        }
        let featureState = {};
        if (feature.id) {
          // `feature-state` expression evaluation requires feature state to be available
          featureState = sourceFeatureState.getState(styleLayer.sourceLayer || '_geojsonTileLayer', String(feature.id));
        }
        return styleLayer.queryIntersectsFeature(
          queryGeometry,
          feature,
          featureState,
          featureGeometry,
          this.tileID.canonical.z,
          args.transform,
          pixelsToTileUnits,
          args.pixelPosMatrix
        );
      };
      this.loadMatchingFeature(
        result,
        match.bucketIndex,
        match.sourceLayerIndex,
        match.featureIndex,
        filter,
        params.layers,
        styleLayers,
        intersectionTest
      );
    }

    return result;
  }

  loadMatchingFeature(
    result,
    bucketIndex,
    sourceLayerIndex,
    featureIndex,
    filter,
    filterLayerIDs,
    styleLayers,
    intersectionTest
  ) {
    const layerIDs = this.bucketLayerIDs[bucketIndex];
    if (filterLayerIDs && !arraysIntersect(filterLayerIDs, layerIDs)) return;

    const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);
    const sourceLayer = this.vtLayers[sourceLayerName];
    const feature = sourceLayer.feature(featureIndex);

    if (!filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) return;

    const { x, y, z } = this.tileID.canonical;
    for (const layerID of layerIDs) {
      if (filterLayerIDs && !filterLayerIDs.includes(layerID)) {
        continue;
      }

      const styleLayer = styleLayers[layerID];
      if (!styleLayer) continue;

      const intersectionZ = !intersectionTest || intersectionTest(feature, styleLayer);
      if (!intersectionZ) {
        // Only applied for non-symbol features
        continue;
      }

      const geojsonFeature = new GeoJSONFeature(feature, z, x, y);
      geojsonFeature.layer = styleLayer.serialize();
      const layerResult = (result[layerID] ??= []);
      layerResult.push({ featureIndex, feature: geojsonFeature, intersectionZ });
    }
  }

  // Given a set of symbol indexes that have already been looked up,
  // return a matching set of GeoJSONFeatures
  lookupSymbolFeatures(symbolFeatureIndexes, bucketIndex, sourceLayerIndex, filterSpec, filterLayerIDs, styleLayers) {
    const result = {};
    this.loadVTLayers();

    const filter = featureFilter(filterSpec);

    for (const symbolFeatureIndex of symbolFeatureIndexes) {
      this.loadMatchingFeature(
        result,
        bucketIndex,
        sourceLayerIndex,
        symbolFeatureIndex,
        filter,
        filterLayerIDs,
        styleLayers
      );
    }
    return result;
  }
}

module.exports = FeatureIndex;

function getBounds(geometry) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const { x, y } of geometry) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function topDownFeatureComparator(a, b) {
  return b - a;
}
