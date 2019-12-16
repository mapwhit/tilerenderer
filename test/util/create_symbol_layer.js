import SymbolBucket from '../../src/data/bucket/symbol_bucket.js';
import SymbolStyleLayer from '../../src/style/style_layer/symbol_style_layer.js';

export function createSymbolBucket(collisionBoxArray, text = 'abcde', globalState) {
  const layer = new SymbolStyleLayer(
    {
      id: 'test',
      type: 'symbol',
      layout: { 'text-font': ['Test'], 'text-field': text }
    },
    globalState
  );
  layer.recalculate({ zoom: 0, zoomHistory: {} });

  return new SymbolBucket({
    overscaling: 1,
    zoom: 0,
    collisionBoxArray,
    layers: [layer]
  });
}
