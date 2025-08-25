import test from 'node:test';
import { createMap, createStyle, initWindow } from '../../../util/util.js';

test('map layers', async t => {
  initWindow(t);

  await t.test('moveLayer', (t, done) => {
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

    map.once('render', () => {
      map.moveLayer('layerId1', 'layerId2');
      t.assert.equal(map.getLayer('layerId1').id, 'layerId1');
      t.assert.equal(map.getLayer('layerId2').id, 'layerId2');
      done();
    });
  });

  await t.test('getLayer', (t, done) => {
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

    map.once('render', () => {
      const mapLayer = map.getLayer('layerId');
      t.assert.equal(mapLayer.id, layer.id);
      t.assert.equal(mapLayer.type, layer.type);
      t.assert.equal(mapLayer.source, layer.source);
      done();
    });
  });

  await t.test('removeLayer restores Map.loaded() to true', (t, done) => {
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

    map.once('render', () => {
      map.removeLayer('layerId');
      map.on('render', () => {
        if (map.loaded()) {
          map.remove();
          done();
        }
      });
    });
  });

  await t.test('setLayoutProperty', async t => {
    await t.test('sets property', (t, done) => {
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

      map.on('style.load', () => {
        const updateLayers = t.mock.method(map.style, '_updateWorkerLayers');

        map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
        map.style.update({});
        t.assert.deepEqual(map.getLayoutProperty('symbol', 'text-transform'), 'lowercase');
        t.assert.equal(updateLayers.mock.callCount(), 1);
        done();
      });
    });

    await t.test('throw before loaded', async t => {
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

    await t.test('fires an error if layer not found', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      map.on('style.load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be styled/);
          done();
        });
        map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
      });
    });

    await t.test('fires a data event', (t, done) => {
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

      map.once('style.load', () => {
        map.once('data', e => {
          if (e.dataType === 'style') {
            done();
          }
        });

        map.setLayoutProperty('background', 'visibility', 'visible');
      });
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

    await t.test('sets visibility on raster layer', (t, done) => {
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

      map.on('style.load', () => {
        map.setLayoutProperty('satellite', 'visibility', 'visible');
        t.assert.deepEqual(map.getLayoutProperty('satellite', 'visibility'), 'visible');
        done();
      });
    });

    await t.test('sets visibility on image layer', (t, done) => {
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

      map.on('style.load', () => {
        map.setLayoutProperty('image', 'visibility', 'visible');
        t.assert.deepEqual(map.getLayoutProperty('image', 'visibility'), 'visible');
        done();
      });
    });
  });

  await t.test('setPaintProperty', async t => {
    await t.test('sets property', (t, done) => {
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

      map.on('style.load', () => {
        map.setPaintProperty('background', 'background-color', 'red');
        t.assert.deepEqual(map.getPaintProperty('background', 'background-color'), 'red');
        done();
      });
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

    await t.test('fires an error if layer not found', (t, done) => {
      const map = createMap({
        style: {
          version: 8,
          sources: {},
          layers: []
        }
      });

      map.on('style.load', () => {
        map.on('error', ({ error }) => {
          t.assert.match(error.message, /does not exist in the map\'s style and cannot be styled/);
          done();
        });
        map.setPaintProperty('non-existant', 'background-color', 'red');
      });
    });
  });
});
