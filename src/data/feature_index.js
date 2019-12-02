import { polygonIntersectsBox } from '@mapwhit/geometry';
import Grid from 'grid-index';
import EvaluationParameters from '../style/evaluation_parameters.js';
import featureFilter from '../style-spec/feature_filter/index.js';
import dictionaryCoder from '../util/dictionary_coder.js';
import { arraysIntersect } from '../util/object.js';
import GeoJSONFeature from '../util/vectortile_to_geojson.js';
import { FeatureIndexArray } from './array_types.js';
import EXTENT from './extent.js';
import loadGeometry from './load_geometry.js';

export default class FeatureIndex {
  constructor(tileID, promoteId) {
    this.tileID = tileID;
    this.grid = new Grid(EXTENT, 16, 0);
    this.grid3D = new Grid(EXTENT, 16, 0);
    this.featureIndexArray = new FeatureIndexArray();
    this.promoteId = promoteId;
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
      this.vtLayers = this.vectorTile?.layers;
      this.sourceLayerCoder = dictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers) : ['_geojsonTileLayer']);
    }
    return this.vtLayers;
  }

  // Finds non-symbol features in this tile at a particular position.
  query(args, styleLayers, sourceFeatureState) {
    this.loadVTLayers();

    const params = args.params || {};
    const pixelsToTileUnits = EXTENT / args.tileSize / args.scale;
    const filter = featureFilter(params.filter, params.globalState);

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
      if (index === previousIndex) {
        continue;
      }
      previousIndex = index;

      const match = this.featureIndexArray.get(index);
      let featureGeometry = null;
      const intersectionTest = (feature, styleLayer, id) => {
        if (!featureGeometry) {
          featureGeometry = loadGeometry(feature);
        }
        let featureState = {};
        if (id !== undefined) {
          // `feature-state` expression evaluation requires feature state to be available
          featureState = sourceFeatureState.getState(styleLayer.sourceLayer || '_geojsonTileLayer', id);
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
    if (filterLayerIDs && !arraysIntersect(filterLayerIDs, layerIDs)) {
      return;
    }

    const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);
    const sourceLayer = this.vtLayers[sourceLayerName];
    const feature = sourceLayer.feature(featureIndex);

    if (!filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) {
      return;
    }

    const id = this.getId(feature, sourceLayerName);

    const { x, y, z } = this.tileID.canonical;
    for (const layerID of layerIDs) {
      if (filterLayerIDs && !filterLayerIDs.includes(layerID)) {
        continue;
      }

      const styleLayer = styleLayers.get(layerID);
      if (!styleLayer) {
        continue;
      }

      const intersectionZ = !intersectionTest || intersectionTest(feature, styleLayer, id);
      if (!intersectionZ) {
        // Only applied for non-symbol features
        continue;
      }

      const geojsonFeature = new GeoJSONFeature(feature, z, x, y, id);
      geojsonFeature.layer = styleLayer;
      const layerResult = (result[layerID] ??= []);
      layerResult.push({ featureIndex, feature: geojsonFeature, intersectionZ });
    }
  }

  // Given a set of symbol indexes that have already been looked up,
  // return a matching set of GeoJSONFeatures
  lookupSymbolFeatures(
    symbolFeatureIndexes,
    bucketIndex,
    sourceLayerIndex,
    { filterSpec, globalState },
    filterLayerIDs,
    styleLayers
  ) {
    const result = {};
    this.loadVTLayers();

    const filter = featureFilter(filterSpec, globalState);

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

  getId(feature, sourceLayerId) {
    let id = feature.id;
    if (this.promoteId) {
      const propName = typeof this.promoteId === 'string' ? this.promoteId : this.promoteId[sourceLayerId];
      id = feature.properties[propName];
      if (typeof id === 'boolean') {
        id = Number(id);
      }
    }
    return id;
  }
}

function getBounds(geometry) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const { x, y } of geometry) {
    if (x < minX) {
      minX = x;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (y > maxY) {
      maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function topDownFeatureComparator(a, b) {
  return b - a;
}
