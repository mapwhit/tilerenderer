const CircleBucket = require('./circle_bucket');

class HeatmapBucket extends CircleBucket {
  // Needed for flow to accept omit: ['layers'] below, due to
  // https://github.com/facebook/flow/issues/4262
}

module.exports = HeatmapBucket;
