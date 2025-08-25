import assert from 'assert';
import pixelsToTileUnits from '../../source/pixels_to_tile_units.js';
import browser from '../../util/browser.js';

export function patternUniformValues(crossfade, painter, tile) {
  const tileRatio = 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom);

  const numTiles = 2 ** tile.tileID.overscaledZ;
  const tileSizeAtNearestZoom = (tile.tileSize * 2 ** painter.transform.tileZoom) / numTiles;

  const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
  const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

  return {
    u_image: 0,
    u_texsize: tile.imageAtlasTexture.size,
    // this assumes all images in the icon atlas texture have the same pixel ratio
    u_scale: [browser.devicePixelRatio, tileRatio, crossfade.fromScale, crossfade.toScale],
    u_fade: crossfade.t,
    // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
    u_pixel_coord_upper: [pixelX >> 16, pixelY >> 16],
    u_pixel_coord_lower: [pixelX & 0xffff, pixelY & 0xffff]
  };
}

export function bgPatternUniformValues(image, crossfade, painter, tile) {
  const imagePosA = painter.imageManager.getPattern(image.from);
  const imagePosB = painter.imageManager.getPattern(image.to);
  assert(imagePosA && imagePosB);
  const { width, height } = painter.imageManager.getPixelSize();

  const numTiles = 2 ** tile.tileID.overscaledZ;
  const tileSizeAtNearestZoom = (tile.tileSize * 2 ** painter.transform.tileZoom) / numTiles;

  const pixelX = tileSizeAtNearestZoom * (tile.tileID.canonical.x + tile.tileID.wrap * numTiles);
  const pixelY = tileSizeAtNearestZoom * tile.tileID.canonical.y;

  return {
    u_image: 0,
    u_pattern_tl_a: imagePosA.tl,
    u_pattern_br_a: imagePosA.br,
    u_pattern_tl_b: imagePosB.tl,
    u_pattern_br_b: imagePosB.br,
    u_texsize: [width, height],
    u_mix: crossfade.t,
    u_pattern_size_a: imagePosA.displaySize,
    u_pattern_size_b: imagePosB.displaySize,
    u_scale_a: crossfade.fromScale,
    u_scale_b: crossfade.toScale,
    u_tile_units_to_pixels: 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom),
    // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
    u_pixel_coord_upper: [pixelX >> 16, pixelY >> 16],
    u_pixel_coord_lower: [pixelX & 0xffff, pixelY & 0xffff]
  };
}
