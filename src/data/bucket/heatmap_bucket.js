import CircleBucket from './circle_bucket.js';

export default class HeatmapBucket extends CircleBucket {
  // Needed for flow to accept omit: ['layers'] below, due to
  // https://github.com/facebook/flow/issues/4262
}
