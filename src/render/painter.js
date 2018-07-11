'use strict';

const browser = require('../util/browser');

const { mat4 } = require('@mapbox/gl-matrix');
const SourceCache = require('../source/source_cache');
const EXTENT = require('../data/extent');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const VertexArrayObject = require('./vertex_array_object');
const { PosArray } = require('../data/array_types');
const posAttributes = require('../data/pos_attributes');
const ProgramConfiguration = require('../data/program_configuration');
const CrossTileSymbolIndex = require('../symbol/cross_tile_symbol_index');
const shaders = require('../shaders');
const Program = require('./program');
const Context = require('../gl/context');
const DepthMode = require('../gl/depth_mode');
const StencilMode = require('../gl/stencil_mode');
const ColorMode = require('../gl/color_mode');
const Color = require('../style-spec/util/color');
const symbol = require('./draw_symbol');
const circle = require('./draw_circle');
const heatmap = require('./draw_heatmap');
const line = require('./draw_line');
const fill = require('./draw_fill');
const fillExtrusion = require('./draw_fill_extrusion');
const background = require('./draw_background');

const draw = {
    symbol,
    circle,
    heatmap,
    line,
    fill,
    'fill-extrusion': fillExtrusion,
    background,
};

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
class Painter {

    constructor(gl, transform) {
        this.context = new Context(gl);
        this.transform = transform;
        this._tileTextures = {};

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

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
            for (const layerId of this.style._order) {
                this.style._layers[layerId].resize();
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
        this.tileExtentVAO = new VertexArrayObject();
        this.tileExtentPatternVAO = new VertexArrayObject();

        const viewportArray = new PosArray();
        viewportArray.emplaceBack(0, 0);
        viewportArray.emplaceBack(1, 0);
        viewportArray.emplaceBack(0, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = context.createVertexBuffer(viewportArray, posAttributes.members);
        this.viewportVAO = new VertexArrayObject();
    }

    /*
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil() {
        const context = this.context;
        const gl = context.gl;

        // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
        // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
        // effectively clearing the stencil buffer: once an upstream patch lands, remove
        // this function in favor of context.clear({ stencil: 0x0 })

        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);
        context.setStencilMode(new StencilMode({ func: gl.ALWAYS, mask: 0 }, 0x0, 0xFF, gl.ZERO, gl.ZERO, gl.ZERO));

        const matrix = mat4.create();
        mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
        mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);

        const program = this.useProgram('clippingMask');
        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

        this.viewportVAO.bind(context, program, this.viewportBuffer, []);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    _renderTileClippingMasks(tileIDs) {
        const context = this.context;
        const gl = context.gl;

        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);

        let idNext = 1;
        this._tileClippingMaskIDs = {};

        for (const tileID of tileIDs) {
            const id = this._tileClippingMaskIDs[tileID.key] = idNext++;

            // Tests will always pass, and ref value will be written to stencil buffer.
            context.setStencilMode(new StencilMode({ func: gl.ALWAYS, mask: 0 }, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE));

            const program = this.useProgram('clippingMask');
            gl.uniformMatrix4fv(program.uniforms.u_matrix, false, tileID.posMatrix);

            // Draw the clipping mask
            this.tileExtentVAO.bind(this.context, program, this.tileExtentBuffer, []);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.length);
        }
    }

    stencilModeForClipping(tileID) {
        const gl = this.context.gl;
        return new StencilMode({ func: gl.EQUAL, mask: 0xFF }, this._tileClippingMaskIDs[tileID.key], 0x00, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    colorModeForRenderPass() {
        const gl = this.context.gl;
        if (this._showOverdrawInspector) {
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;

            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        } else if (this.renderPass === 'opaque') {
            return ColorMode.unblended;
        } else {
            return ColorMode.alphaBlended;
        }
    }

    depthModeForSublayer(n, mask, func) {
        const farDepth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        const nearDepth = farDepth - 1 + this.depthRange;
        return new DepthMode(func || this.context.gl.LEQUAL, mask, [nearDepth, farDepth]);
    }

    render(style, options) {
        this.style = style;
        this.options = options;

        this.lineAtlas = style.lineAtlas;
        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;

        this.symbolFadeChange = style.placement.symbolFadeChange(browser.now());

        for (const id in style.sourceCaches) {
            const sourceCache = this.style.sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);
            }
        }

        const layerIds = this.style._order;

        // Offscreen pass
        // We first do all rendering that requires rendering to a separate
        // framebuffer, and then save those for rendering back to the map
        // later: in doing this we avoid doing expensive framebuffer restores.
        this.renderPass = 'offscreen';
        {
            let sourceCache;
            let coords = [];
            this.depthRboNeedsClear = true;

            for (let i = 0; i < layerIds.length; i++) {
                const layer = this.style._layers[layerIds[i]];

                if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom)) continue;

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];

                    if (sourceCache) {
                        coords = sourceCache.getVisibleCoordinates();
                        coords.reverse();
                    }
                }

                if (!coords.length) continue;

                this.renderLayer(this, (sourceCache), layer, coords);
            }

            // Rebind the main framebuffer now that all offscreen layers
            // have been rendered:
            this.context.bindFramebuffer.set(null);
        }

        // Clear buffers in preparation for drawing to the main framebuffer
        this.context.clear({ color: options.showOverdrawInspector ? Color.black : Color.transparent, depth: 1 });

        this._showOverdrawInspector = options.showOverdrawInspector;

        this.depthRange = (style._order.length + 2) * this.numSublayers * this.depthEpsilon;

        // Opaque pass
        // Draw opaque layers top-to-bottom first.
        this.renderPass = 'opaque';
        {
            let sourceCache;
            let coords = [];

            this.currentLayer = layerIds.length - 1;

            for (this.currentLayer; this.currentLayer >= 0; this.currentLayer--) {
                const layer = this.style._layers[layerIds[this.currentLayer]];

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];

                    if (sourceCache) {
                        this.clearStencil();
                        coords = sourceCache.getVisibleCoordinates();
                        if (sourceCache.getSource().isTileClipped) {
                            this._renderTileClippingMasks(coords);
                        }
                    }
                }

                this.renderLayer(this, (sourceCache), layer, coords);
            }
        }

        // Translucent pass
        // Draw all other layers bottom-to-top.
        this.renderPass = 'translucent';
        {
            let sourceCache;
            let coords = [];
            let symbolCoords = [];

            this.currentLayer = 0;

            for (this.currentLayer; this.currentLayer < layerIds.length; this.currentLayer++) {
                const layer = this.style._layers[layerIds[this.currentLayer]];

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];
                    symbolCoords = [];

                    if (sourceCache) {
                        this.clearStencil();
                        coords = sourceCache.getVisibleCoordinates(false);
                        // For symbol layers in the translucent pass, we add extra tiles to
                        // the renderable set for cross-tile symbol fading.
                        // Symbol layers don't use tile clipping, so no need to render
                        // separate clipping masks
                        symbolCoords = sourceCache.getVisibleCoordinates(true);
                        if (sourceCache.getSource().isTileClipped) {
                            this._renderTileClippingMasks(coords);
                        }
                    }

                    coords.reverse();
                    symbolCoords.reverse();
                }

                this.renderLayer(this, sourceCache, layer, layer.type === 'symbol' ? symbolCoords : coords);
            }
        }

        if (this.options.showTileBoundaries) {
            const sourceCache = this.style.sourceCaches[Object.keys(this.style.sourceCaches)[0]];
            if (sourceCache) {
                draw.debug(this, sourceCache, sourceCache.getVisibleCoordinates());
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
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && !coords.length) return;
        this.id = layer.id;

        draw[layer.type](painter, sourceCache, layer, coords);
    }

    /**
     * Transform a matrix to incorporate the *-translate and *-translate-anchor properties into it.
     * @param inViewportPixelUnitsUnits True when the units accepted by the matrix are in viewport pixels instead of tile units.
     * @returns {Float32Array} matrix
     */
    translatePosMatrix(matrix, tile, translate, translateAnchor, inViewportPixelUnitsUnits) {
        if (!translate[0] && !translate[1]) return matrix;

        const angle = inViewportPixelUnitsUnits ?
            (translateAnchor === 'map' ? this.transform.angle : 0) :
            (translateAnchor === 'viewport' ? -this.transform.angle : 0);

        if (angle) {
            const sinA = Math.sin(angle);
            const cosA = Math.cos(angle);
            translate = [
                translate[0] * cosA - translate[1] * sinA,
                translate[0] * sinA + translate[1] * cosA
            ];
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

    _createProgramCached(name, programConfiguration) {
        this.cache = this.cache || {};
        const key = `${name}${programConfiguration.cacheKey || ''}${this._showOverdrawInspector ? '/overdraw' : ''}`;
        if (!this.cache[key]) {
            this.cache[key] = new Program(this.context, shaders[name], programConfiguration, this._showOverdrawInspector);
        }
        return this.cache[key];
    }

    useProgram(name, programConfiguration) {
        const nextProgram = this._createProgramCached(name, programConfiguration || this.emptyProgramConfiguration);

        this.context.program.set(nextProgram.program);

        return nextProgram;
    }
}

module.exports = Painter;
