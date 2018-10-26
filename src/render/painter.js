import glMatrix from '@mapbox/gl-matrix';
import { Color } from '@mapwhit/style-expressions';
import { LineStripIndexArray, PosArray, RasterBoundsArray, TriangleIndexArray } from '../data/array_types.js';
import EXTENT from '../data/extent.js';
import posAttributes from '../data/pos_attributes.js';
import ProgramConfiguration from '../data/program_configuration.js';
import rasterBoundsAttributes from '../data/raster_bounds_attributes.js';
import SegmentVector from '../data/segment.js';
import ColorMode from '../gl/color_mode.js';
import Context from '../gl/context.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import shaders from '../shaders/index.js';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import SourceCache from '../source/source_cache.js';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index.js';
import browser from '../util/browser.js';
import background from './draw_background.js';
import circle from './draw_circle.js';
import debug from './draw_debug.js';
import fill from './draw_fill.js';
import fillExtrusion from './draw_fill_extrusion.js';
import heatmap from './draw_heatmap.js';
import hillshade from './draw_hillshade.js';
import line from './draw_line.js';
import raster from './draw_raster.js';
import symbol from './draw_symbol.js';
import { clippingMaskUniformValues } from './program/clipping_mask_program.js';
import { programUniforms } from './program/program_uniforms.js';
import Program from './program.js';
import updateTileMasks from './tile_mask.js';

const { mat4 } = glMatrix;
const draw = {
  symbol,
  circle,
  heatmap,
  line,
  fill,
  'fill-extrusion': fillExtrusion,
  hillshade,
  raster,
  background,
  debug
};

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
export default class Painter {
  constructor(gl, transform) {
    this.context = new Context(gl);
    this.transform = transform;
    this._tileTextures = {};

    this.setup();

    // Within each layer there are multiple distinct z-planes that can be drawn to.
    // This is implemented using the WebGL depth buffer.
    this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
    this.depthEpsilon = 1 / 2 ** 16;

    this.depthRboNeedsClear = true;

    this.emptyProgramConfiguration = new ProgramConfiguration();

    this.crossTileSymbolIndex = new CrossTileSymbolIndex();
  }

  /*
   * Update the GL viewport, projection matrix, and transforms to compensate
   * for a new width and height value.
   */
  resize(width, height) {
    const gl = this.context.gl;

    this.width = width * browser.devicePixelRatio;
    this.height = height * browser.devicePixelRatio;
    this.context.viewport.set([0, 0, this.width, this.height]);

    if (this.style) {
      for (const layer of this.style._layers.values()) {
        layer.resize();
      }
    }

    if (this.depthRbo) {
      gl.deleteRenderbuffer(this.depthRbo);
      this.depthRbo = null;
    }
  }

  setup() {
    const context = this.context;

    const tileExtentArray = new PosArray();
    tileExtentArray.emplaceBack(0, 0);
    tileExtentArray.emplaceBack(EXTENT, 0);
    tileExtentArray.emplaceBack(0, EXTENT);
    tileExtentArray.emplaceBack(EXTENT, EXTENT);
    this.tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
    this.tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

    const debugArray = new PosArray();
    debugArray.emplaceBack(0, 0);
    debugArray.emplaceBack(EXTENT, 0);
    debugArray.emplaceBack(0, EXTENT);
    debugArray.emplaceBack(EXTENT, EXTENT);
    this.debugBuffer = context.createVertexBuffer(debugArray, posAttributes.members);
    this.debugSegments = SegmentVector.simpleSegment(0, 0, 4, 5);

    const rasterBoundsArray = new RasterBoundsArray();
    rasterBoundsArray.emplaceBack(0, 0, 0, 0);
    rasterBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
    rasterBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
    rasterBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
    this.rasterBoundsBuffer = context.createVertexBuffer(rasterBoundsArray, rasterBoundsAttributes.members);
    this.rasterBoundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

    const viewportArray = new PosArray();
    viewportArray.emplaceBack(0, 0);
    viewportArray.emplaceBack(1, 0);
    viewportArray.emplaceBack(0, 1);
    viewportArray.emplaceBack(1, 1);
    this.viewportBuffer = context.createVertexBuffer(viewportArray, posAttributes.members);
    this.viewportSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

    const tileLineStripIndices = new LineStripIndexArray();
    tileLineStripIndices.emplaceBack(0);
    tileLineStripIndices.emplaceBack(1);
    tileLineStripIndices.emplaceBack(3);
    tileLineStripIndices.emplaceBack(2);
    tileLineStripIndices.emplaceBack(0);
    this.tileBorderIndexBuffer = context.createIndexBuffer(tileLineStripIndices);

    const quadTriangleIndices = new TriangleIndexArray();
    quadTriangleIndices.emplaceBack(0, 1, 2);
    quadTriangleIndices.emplaceBack(2, 1, 3);
    this.quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);

    const gl = this.context.gl;
    this.stencilClearMode = new StencilMode({ func: gl.ALWAYS, mask: 0 }, 0x0, 0xff, gl.ZERO, gl.ZERO, gl.ZERO);
  }

  /*
   * Reset the drawing canvas by clearing the stencil buffer so that we can draw
   * new tiles at the same location, while retaining previously drawn pixels.
   */
  clearStencil() {
    const context = this.context;
    const gl = context.gl;

    this.nextStencilID = 1;
    this.currentStencilSource = undefined;

    // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
    // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
    // effectively clearing the stencil buffer: once an upstream patch lands, remove
    // this function in favor of context.clear({ stencil: 0x0 })

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
    mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);

    this.useProgram('clippingMask').draw(
      context,
      gl.TRIANGLES,
      DepthMode.disabled,
      this.stencilClearMode,
      ColorMode.disabled,
      CullFaceMode.disabled,
      clippingMaskUniformValues(matrix),
      '$clipping',
      this.viewportBuffer,
      this.quadTriangleIndexBuffer,
      this.viewportSegments
    );
  }

  _renderTileClippingMasks(layer, tileIDs) {
    if (this.currentStencilSource === layer.source || !layer.isTileClipped() || !tileIDs || !tileIDs.length) {
      return;
    }

    this.currentStencilSource = layer.source;

    const context = this.context;
    const gl = context.gl;

    if (this.nextStencilID + tileIDs.length > 256) {
      // we'll run out of fresh IDs so we need to clear and start from scratch
      this.clearStencil();
    }

    context.setColorMode(ColorMode.disabled);
    context.setDepthMode(DepthMode.disabled);

    const program = this.useProgram('clippingMask');

    this._tileClippingMaskIDs = {};

    for (const tileID of tileIDs) {
      const id = (this._tileClippingMaskIDs[tileID.key] = this.nextStencilID++);

      program.draw(
        context,
        gl.TRIANGLES,
        DepthMode.disabled,
        // Tests will always pass, and ref value will be written to stencil buffer.
        new StencilMode({ func: gl.ALWAYS, mask: 0 }, id, 0xff, gl.KEEP, gl.KEEP, gl.REPLACE),
        ColorMode.disabled,
        CullFaceMode.disabled,
        clippingMaskUniformValues(tileID.posMatrix),
        '$clipping',
        this.tileExtentBuffer,
        this.quadTriangleIndexBuffer,
        this.tileExtentSegments
      );
    }
  }

  stencilModeFor3D() {
    if (this.nextStencilID + 1 > 256) {
      this.clearStencil();
    }

    const id = this.nextStencilID++;
    const gl = this.context.gl;
    return new StencilMode({ func: gl.NOTEQUAL, mask: 0xff }, id, 0xff, gl.KEEP, gl.KEEP, gl.REPLACE);
  }

  stencilModeForClipping(tileID) {
    const gl = this.context.gl;
    return new StencilMode(
      { func: gl.EQUAL, mask: 0xff },
      this._tileClippingMaskIDs[tileID.key],
      0x00,
      gl.KEEP,
      gl.KEEP,
      gl.REPLACE
    );
  }

  colorModeForRenderPass() {
    const gl = this.context.gl;
    if (this._showOverdrawInspector) {
      const numOverdrawSteps = 8;
      const a = 1 / numOverdrawSteps;

      return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
    }
    if (this.renderPass === 'opaque') {
      return ColorMode.unblended;
    }
    return ColorMode.alphaBlended;
  }

  depthModeForSublayer(n, mask, func) {
    if (!this.opaquePassEnabledForLayer()) {
      return DepthMode.disabled;
    }
    const depth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
    return new DepthMode(func || this.context.gl.LEQUAL, mask, [depth, depth]);
  }

  /*
   * The opaque pass and 3D layers both use the depth buffer.
   * Layers drawn above 3D layers need to be drawn using the
   * painter's algorithm so that they appear above 3D features.
   * This returns true for layers that can be drawn using the
   * opaque pass.
   */
  opaquePassEnabledForLayer() {
    return this.currentLayer < this.opaquePassCutoff;
  }

  render(style, options) {
    this.style = style;
    this.options = options;

    this.lineAtlas = style.lineAtlas;
    this.imageManager = style.imageManager;
    this.glyphManager = style.glyphManager;

    this.symbolFadeChange = style.placement.symbolFadeChange(browser.now());

    const sourceCaches = style._sources;

    for (const id in sourceCaches) {
      const sourceCache = sourceCaches[id];
      if (sourceCache.used) {
        sourceCache.prepare(this.context);
      }
    }

    const coordsAscending = {};
    const coordsDescending = {};
    const coordsDescendingSymbol = {};

    for (const id in sourceCaches) {
      const sourceCache = sourceCaches[id];
      coordsAscending[id] = sourceCache.getVisibleCoordinates();
      coordsDescending[id] = coordsAscending[id].slice().reverse();
      coordsDescendingSymbol[id] = sourceCache.getVisibleCoordinates(true).reverse();
    }

    for (const id in sourceCaches) {
      const sourceCache = sourceCaches[id];
      const source = sourceCache.getSource();
      if (source.type !== 'raster' && source.type !== 'raster-dem') {
        continue;
      }
      const visibleTiles = [];
      for (const coord of coordsAscending[id]) {
        visibleTiles.push(sourceCache.getTile(coord));
      }
      updateTileMasks(visibleTiles, this.context);
    }

    const layers = Array.from(style._layers.values());

    this.opaquePassCutoff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].is3D()) {
        this.opaquePassCutoff = i;
        break;
      }
    }

    // Offscreen pass ===============================================
    // We first do all rendering that requires rendering to a separate
    // framebuffer, and then save those for rendering back to the map
    // later: in doing this we avoid doing expensive framebuffer restores.
    this.renderPass = 'offscreen';
    this.depthRboNeedsClear = true;

    for (const layer of layers) {
      if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom)) {
        continue;
      }

      const coords = coordsDescending[layer.source];
      if (!coords.length) {
        continue;
      }

      this.renderLayer(this, sourceCaches[layer.source], layer, coords);
    }

    // Rebind the main framebuffer now that all offscreen layers have been rendered:
    this.context.bindFramebuffer.set(null);

    // Clear buffers in preparation for drawing to the main framebuffer
    this.context.clear({ color: options.showOverdrawInspector ? Color.black : Color.transparent, depth: 1 });

    this.clearStencil();

    this._showOverdrawInspector = options.showOverdrawInspector;
    this.depthRangeFor3D = [0, 1 - (style._layers.size + 2) * this.numSublayers * this.depthEpsilon];

    // Opaque pass ===============================================
    // Draw opaque layers top-to-bottom first.
    this.renderPass = 'opaque';

    for (this.currentLayer = layers.length - 1; this.currentLayer >= 0; this.currentLayer--) {
      const layer = layers[this.currentLayer];
      const sourceCache = sourceCaches[layer.source];
      const coords = coordsAscending[layer.source];

      this._renderTileClippingMasks(layer, coords);
      this.renderLayer(this, sourceCache, layer, coords);
    }

    // Translucent pass ===============================================
    // Draw all other layers bottom-to-top.
    this.renderPass = 'translucent';

    for (this.currentLayer = 0; this.currentLayer < layers.length; this.currentLayer++) {
      const layer = layers[this.currentLayer];
      const sourceCache = sourceCaches[layer.source];

      // For symbol layers in the translucent pass, we add extra tiles to the renderable set
      // for cross-tile symbol fading. Symbol layers don't use tile clipping, so no need to render
      // separate clipping masks
      const coords = (layer.type === 'symbol' ? coordsDescendingSymbol : coordsDescending)[layer.source];

      this._renderTileClippingMasks(layer, coordsAscending[layer.source]);
      this.renderLayer(this, sourceCache, layer, coords);
    }

    if (this.options.showTileBoundaries) {
      for (const id in sourceCaches) {
        draw.debug(this, sourceCaches[id], coordsAscending[id]);
        break;
      }
    }
  }

  setupOffscreenDepthRenderbuffer() {
    const context = this.context;
    // All of the 3D textures will use the same depth renderbuffer.
    if (!this.depthRbo) {
      this.depthRbo = context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, this.width, this.height);
    }
  }

  renderLayer(painter, sourceCache, layer, coords) {
    if (layer.isHidden(this.transform.zoom)) {
      return;
    }
    if (layer.type !== 'background' && !coords.length) {
      return;
    }
    this.id = layer.id;

    draw[layer.type](painter, sourceCache, layer, coords, this.style.placement.variableOffsets);
  }

  /**
   * Transform a matrix to incorporate the *-translate and *-translate-anchor properties into it.
   * @param inViewportPixelUnitsUnits True when the units accepted by the matrix are in viewport pixels instead of tile units.
   * @returns {Float32Array} matrix
   */
  translatePosMatrix(matrix, tile, translate, translateAnchor, inViewportPixelUnitsUnits) {
    if (!translate[0] && !translate[1]) {
      return matrix;
    }

    const angle = inViewportPixelUnitsUnits
      ? translateAnchor === 'map'
        ? this.transform.angle
        : 0
      : translateAnchor === 'viewport'
        ? -this.transform.angle
        : 0;

    if (angle) {
      const sinA = Math.sin(angle);
      const cosA = Math.cos(angle);
      translate = [translate[0] * cosA - translate[1] * sinA, translate[0] * sinA + translate[1] * cosA];
    }

    const translation = [
      inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], this.transform.zoom),
      inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], this.transform.zoom),
      0
    ];

    const translatedMatrix = new Float32Array(16);
    mat4.translate(translatedMatrix, matrix, translation);
    return translatedMatrix;
  }

  saveTileTexture(texture) {
    const textures = this._tileTextures[texture.size[0]];
    if (!textures) {
      this._tileTextures[texture.size[0]] = [texture];
    } else {
      textures.push(texture);
    }
  }

  getTileTexture(size) {
    const textures = this._tileTextures[size];
    return textures && textures.length > 0 ? textures.pop() : null;
  }

  /**
   * Checks whether a pattern image is needed, and if it is, whether it is not loaded.
   *
   * @returns true if a needed image is missing and rendering needs to be skipped.
   */
  isPatternMissing(image) {
    if (!image) {
      return false;
    }
    const imagePosA = this.imageManager.getPattern(image.from);
    const imagePosB = this.imageManager.getPattern(image.to);
    return !imagePosA || !imagePosB;
  }

  useProgram(name, programConfiguration = this.emptyProgramConfiguration) {
    this.cache = this.cache || {};
    const key = `${name}${programConfiguration.cacheKey || ''}${this._showOverdrawInspector ? '/overdraw' : ''}`;
    if (!this.cache[key]) {
      this.cache[key] = new Program(
        this.context,
        shaders[name],
        programConfiguration,
        programUniforms[name],
        this._showOverdrawInspector
      );
    }
    return this.cache[key];
  }
}
