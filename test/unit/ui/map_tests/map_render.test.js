import test from 'node:test';
import { createMap, createStyle, initWindow } from '../../../util/util.js';

test('map render', async t => {
  initWindow(t);

  await t.test('render stabilizes', (t, done) => {
    const style = createStyle();
    style.sources.mapbox = {
      type: 'vector',
      minzoom: 1,
      maxzoom: 10,
      tiles: async () => {}
    };
    style.layers.push({
      id: 'layerId',
      type: 'circle',
      source: 'mapbox',
      'source-layer': 'sourceLayer'
    });

    let timer;
    const map = createMap({ style: style });
    map.on('render', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        map.off('render');
        map.on('render', t.fail);
        t.assert.ok(!map._frameId, 'no rerender scheduled');
        done();
      }, 100);
    });
  });
});
