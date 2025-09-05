import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import colors from 'chalk';

// /test/integration
const integrationPath = path.join(import.meta.dirname, '..');
// mvt-fixtures -> /test/integration/node_modules/@mapbox/mvt-fixtures
const mapboxMVTFixturesPath = path.join(
  path.dirname(new URL(import.meta.resolve('@mapbox/mvt-fixtures')).pathname),
  '..'
);

export default function () {
  function localizeURL(url) {
    return url.replace(/^local:\/\//, '');
  }

  function localizeMapboxSpriteURL(url) {
    return url.replace(/^mapbox:\/\//, '');
  }

  function localizeMapboxFontsURL(url) {
    return url.replace(/^mapbox:\/\/fonts/, 'glyphs');
  }

  function localizeMapboxTilesURL(url) {
    return url.replace(/^mapbox:\/\//, 'tiles/');
  }

  function localizeMapboxTilesetURL(url) {
    return url.replace(/^mapbox:\/\//, 'tilesets/');
  }

  async function localizeSourceURLs(source) {
    if (source.url) {
      source.url = localizeMapboxTilesetURL(source.url);
      source.url = localizeURL(source.url);
      if (source.url.endsWith('.png')) {
        source.url = await load(integrationPath, source.url);
      } else {
        Object.assign(source, loadJSON(source.url));
        delete source.url;
      }
    }

    if (source.tiles) {
      for (const tile in source.tiles) {
        source.tiles[tile] = localizeMapboxTilesURL(source.tiles[tile]);
        source.tiles[tile] = localizeURL(source.tiles[tile]);
      }
      source.tiles = loadTile(source.tiles, source.scheme);
    }

    if (source.urls) {
      source.urls = source.urls.map(localizeMapboxTilesetURL);
      source.urls = source.urls.map(localizeURL);
    }

    if (source.data && typeof source.data === 'string') {
      source.data = localizeURL(source.data);
      source.data = loadJSON(source.data);
    }
  }

  async function localizeStyleURLs(style) {
    for (const source in style.sources) {
      await localizeSourceURLs(style.sources[source]);
    }

    if (style.glyphs) {
      style.glyphs = localizeMapboxFontsURL(style.glyphs);
      style.glyphs = localizeURL(style.glyphs);
      style.glyphs = loadGlyphs(style.glyphs);
    }

    if (style.sprite) {
      style.sprite = localizeMapboxSpriteURL(style.sprite);
      style.sprite = localizeURL(style.sprite);
      style.sprite = loadSprite(style.sprite, style.metadata?.test?.pixelRatio);
    }
  }

  function load(directory, fname, controller = {}) {
    return readFile(path.join(directory, fname), { signal: controller.signal });
  }

  function loadTile(tiles, scheme) {
    return ({ x, y, z }, controller) => {
      const url = tiles[(x + y) % tiles.length]
        .replace('{prefix}', (x % 16).toString(16) + (y % 16).toString(16))
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(scheme === 'tms' ? 2 ** z - y - 1 : y));
      const directory = url.startsWith('mvt-fixtures') ? mapboxMVTFixturesPath : integrationPath;
      return load(directory, url, controller);
    };
  }

  function loadGlyphs(glyphs) {
    return (fontstack, range) => {
      const begin = range * 256;
      const end = begin + 255;
      const url = glyphs.replace('{fontstack}', fontstack).replace('{range}', `${begin}-${end}`).replace(/\?.*/, '');
      return load(integrationPath, url);
    };
  }

  async function loadSprite(sprite, pixelRatio) {
    if (pixelRatio === 2) {
      sprite += '@2x';
    }
    const [json, image] = await Promise.all([
      load(integrationPath, sprite + '.json'),
      load(integrationPath, sprite + '.png')
    ]);
    return { json: JSON.parse(json.toString()), image: toArrayBuffer(image) };
  }

  function toArrayBuffer(buffer) {
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; ++i) {
      view[i] = buffer[i];
    }
    return arrayBuffer;
  }

  function loadJSON(url) {
    let json;
    try {
      const relativePath = url.replace(/^local:\/\//, '');
      const directory = integrationPath;
      json = readFileSync(path.join(directory, relativePath));
    } catch (error) {
      console.log(colors.blue(`* ${error}`));
      return;
    }

    try {
      json = JSON.parse(json);
    } catch (error) {
      console.log(colors.blue(`* Error while parsing ${url}: ${error}`));
      return;
    }
    return json;
  }

  return {
    localizeURLs: async function (style) {
      await localizeStyleURLs(style);
      if (style.metadata?.test?.operations) {
        await Promise.all(
          style.metadata.test.operations.map(async op => {
            if (op[0] === 'addSource') {
              await localizeSourceURLs(op[2]);
            } else if (op[0] === 'setStyle') {
              if (typeof op[1] === 'object') {
                await localizeStyleURLs(op[1]);
                return;
              }

              const styleJSON = loadJSON(op[1]);
              if (!styleJSON) {
                return;
              }

              await localizeStyleURLs(styleJSON);

              op[1] = styleJSON;
              op[2] = { diff: false };
            }
          })
        );
      }
    },
    loadJSON
  };
}
