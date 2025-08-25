import test from 'node:test';
import RasterTileSource from '../../../src/source/raster_tile_source.js';
import { OverscaledTileID } from '../../../src/source/tile_id.js';
import _window from '../../util/window.js';

function createSource(options) {
  options.tiles ??= loadTile;
  const source = new RasterTileSource('id', options, options.eventedParent);
  source.onAdd({
    transform: { angle: 0, pitch: 0, showCollisionBoxes: false }
  });

  source.on('error', e => {
    throw e.error;
  });

  return source;

  function loadTile() {
    return Promise.resolve(new ArrayBuffer());
  }
}

test('RasterTileSource', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('respects TileJSON.bounds', (t, done) => {
    const source = createSource({
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Mapbox',
      bounds: [-47, -7, -45, -5]
    });
    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        t.assert.ok(!source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132)), 'returns false for tiles outside bounds');
        t.assert.ok(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132)), 'returns true for tiles inside bounds');
        done();
      }
    });
  });

  await t.test('does not error on invalid bounds', (t, done) => {
    const source = createSource({
      minzoom: 0,
      maxzoom: 22,
      attribution: 'Mapbox',
      bounds: [-47, -7, -45, 91]
    });

    source.on('data', e => {
      if (e.sourceDataType === 'metadata') {
        t.assert.deepEqual(
          source.tileBounds.bounds,
          { _sw: { lng: -47, lat: -7 }, _ne: { lng: -45, lat: 90 } },
          'converts invalid bounds to closest valid bounds'
        );
        done();
      }
    });
  });
});
