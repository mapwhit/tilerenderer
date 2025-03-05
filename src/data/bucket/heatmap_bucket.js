const CircleBucket = require('./circle_bucket');

const { register } = require('../../util/transfer_registry');

class HeatmapBucket extends CircleBucket {
  // Needed for flow to accept omit: ['layers'] below, due to
  // https://github.com/facebook/flow/issues/4262
}

register('HeatmapBucket', HeatmapBucket, { omit: ['layers'] });

module.exports = HeatmapBucket;
