import test from 'node:test';
import { createMap, createStyle, initWindow, waitForEvent } from '../../../util/util.js';

test('map layers', async t => {
  initWindow(t);

  await t.test('moveLayer', async t => {
    const map = createMap({
      style: Object.assign(createStyle(), {
        sources: {
          mapbox: {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: async () => {}
          }
        },
        layers: [
          {
            id: 'layerId1',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
          },
          {
            id: 'layerId2',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
          }
        ]
      })
    });

    await map.once('render');
    map.moveLayer('layerId1', 'layerId2');
    t.assert.equal(map.getLayer('layerId1').id, 'layerId1');
    t.assert.equal(map.getLayer('layerId2').id, 'layerId2');
  });

  await t.test('getLayer', async t => {
    const layer = {
      id: 'layerId',
      type: 'circle',
      source: 'mapbox',
      'source-layer': 'sourceLayer'
    };
    const map = createMap({
      style: Object.assign(createStyle(), {
        sources: {
          mapbox: {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: async () => {}
          }
        },
        layers: [layer]
      })
    });

    await map.once('render');
    const mapLayer = map.getLayer('layerId');
    t.assert.equal(mapLayer.id, layer.id);
    t.assert.equal(mapLayer.type, layer.type);
    t.assert.equal(mapLayer.source, layer.source);
  });

  await t.test('removeLayer restores Map.loaded() to true', async _t => {
    const map = createMap({
      style: Object.assign(createStyle(), {
        sources: {
          mapbox: {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            tiles: async () => {}
          }
        },
        layers: [
          {
            id: 'layerId',
            type: 'circle',
            source: 'mapbox',
            'source-layer': 'sourceLayer'
          }
        ]
      })
    });

    await map.once('render');
    map.removeLayer('layerId');
    await waitForEvent(map, 'render', () => map.loaded());
    map.remove();
  });

  await t.test('setLayoutProperty', async t => {
    await t.test('sets property', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            geojson: {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: []
              }
            }
          },
          layers: [
            {
              id: 'symbol',
              type: 'symbol',
              source: 'geojson',
              layout: {
                'text-transform': 'uppercase'
              }
            }
          ]
        }
      });

      await map.once('style.load');
      const updateLayers = t.mock.method(map.style, '_updateWorkerLayers');

      map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
      map.style.update({});
      t.assert.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
      t.assert.equal(updateLayers.mock.callCount(), 1);
    });

    await t.test('throw before loaded', t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      t.assert.throws(
        () => {
          map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
        },
        Error,
        /load/i
      );
    });

    await t.test('fires an error if layer not found', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      await map.once('style.load');
      const errorPromise = map.once('error');
      map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
      const { error } = await errorPromise;
      t.assert.match(error.message, /does not exist in the map's style and cannot be styled/);
    });

    await t.test('fires a data event', async t => {
      // background layers do not have a source
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      await map.once('style.load');
      const dataPromise = map.once('data');
      map.setLayoutProperty('background', 'visibility', 'visible');
      const e = await dataPromise;
      t.assert.equal(e.dataType, 'style');
    });

    await t.test('sets visibility on background layer', (t, done) => {
      // background layers do not have a source
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      map.on('style.load', () => {
        map.setLayoutProperty('background', 'visibility', 'visible');
        t.assert.deepEqual(map.getLayoutProperty('background', 'visibility'), 'visible');
        done();
      });
    });

    await t.test('sets visibility on raster layer', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: async () => {}
            }
          },
          layers: [
            {
              id: 'satellite',
              type: 'raster',
              source: 'satellite',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      // Suppress errors because we're not loading tiles from a real URL.
      map.on('error', () => {});

      await map.once('style.load');
      map.setLayoutProperty('satellite', 'visibility', 'visible');
      t.assert.deepEqual(map.getLayoutProperty('satellite', 'visibility'), 'visible');
    });

    await t.test('sets visibility on image layer', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {
            image: {
              type: 'image',
              url: new ArrayBuffer(0),
              coordinates: [
                [-122.51596391201019, 37.56238816766053],
                [-122.51467645168304, 37.56410183312965],
                [-122.51309394836426, 37.563391708549425],
                [-122.51423120498657, 37.56161849366671]
              ]
            }
          },
          layers: [
            {
              id: 'image',
              type: 'raster',
              source: 'image',
              layout: {
                visibility: 'none'
              }
            }
          ]
        }
      });

      await map.once('style.load');
      map.setLayoutProperty('image', 'visibility', 'visible');
      t.assert.deepEqual(map.getLayoutProperty('image', 'visibility'), 'visible');
    });
  });

  await t.test('setPaintProperty', async t => {
    await t.test('sets property', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background'
            }
          ]
        }
      });

      await map.once('style.load');
      map.setPaintProperty('background', 'background-color', 'red');
      t.assert.deepEqual(map.getPaintProperty('background', 'background-color'), 'red');
    });

    await t.test('throw before loaded', t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      t.assert.throws(
        () => {
          map.setPaintProperty('background', 'background-color', 'red');
        },
        Error,
        /load/i
      );
    });

    await t.test('fires an error if layer not found', async t => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      await map.once('style.load');
      const errorPromise = map.once('error');
      map.setPaintProperty('non-existant', 'background-color', 'red');
      const { error } = await errorPromise;
      t.assert.match(error.message, /does not exist in the map's style and cannot be styled/);
    });
  });
});
