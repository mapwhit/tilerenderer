import { deepEqual } from '../util/object.js';
import ColorMode from './color_mode.js';
import Framebuffer from './framebuffer.js';
import IndexBuffer from './index_buffer.js';
import {
  ActiveTextureUnit,
  BindElementBuffer,
  BindFramebuffer,
  BindRenderbuffer,
  BindTexture,
  BindVertexArrayOES,
  BindVertexBuffer,
  Blend,
  BlendColor,
  BlendFunc,
  ClearColor,
  ClearDepth,
  ClearStencil,
  ColorMask,
  CullFace,
  CullFaceSide,
  DepthFunc,
  DepthMask,
  DepthRange,
  DepthTest,
  FrontFace,
  PixelStoreUnpack,
  PixelStoreUnpackPremultiplyAlpha,
  Program,
  StencilFunc,
  StencilMask,
  StencilOp,
  StencilTest,
  Viewport
} from './value.js';
import VertexBuffer from './vertex_buffer.js';

class Context {
  constructor(gl) {
    this.gl = gl;
    this.extVertexArrayObject = this.gl.getExtension('OES_vertex_array_object');

    this.clearColor = new ClearColor(this);
    this.clearDepth = new ClearDepth(this);
    this.clearStencil = new ClearStencil(this);
    this.colorMask = new ColorMask(this);
    this.depthMask = new DepthMask(this);
    this.stencilMask = new StencilMask(this);
    this.stencilFunc = new StencilFunc(this);
    this.stencilOp = new StencilOp(this);
    this.stencilTest = new StencilTest(this);
    this.depthRange = new DepthRange(this);
    this.depthTest = new DepthTest(this);
    this.depthFunc = new DepthFunc(this);
    this.blend = new Blend(this);
    this.blendFunc = new BlendFunc(this);
    this.blendColor = new BlendColor(this);
    this.cullFace = new CullFace(this);
    this.cullFaceSide = new CullFaceSide(this);
    this.frontFace = new FrontFace(this);
    this.program = new Program(this);
    this.activeTexture = new ActiveTextureUnit(this);
    this.viewport = new Viewport(this);
    this.bindFramebuffer = new BindFramebuffer(this);
    this.bindRenderbuffer = new BindRenderbuffer(this);
    this.bindTexture = new BindTexture(this);
    this.bindVertexBuffer = new BindVertexBuffer(this);
    this.bindElementBuffer = new BindElementBuffer(this);
    this.bindVertexArrayOES = this.extVertexArrayObject && new BindVertexArrayOES(this);
    this.pixelStoreUnpack = new PixelStoreUnpack(this);
    this.pixelStoreUnpackPremultiplyAlpha = new PixelStoreUnpackPremultiplyAlpha(this);

    this.extTextureFilterAnisotropic =
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if (this.extTextureFilterAnisotropic) {
      this.extTextureFilterAnisotropicMax = gl.getParameter(
        this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT
      );
    }

    this.extTextureHalfFloat = gl.getExtension('OES_texture_half_float');
    if (this.extTextureHalfFloat) {
      gl.getExtension('OES_texture_half_float_linear');
    }
  }

  createIndexBuffer(array, dynamicDraw) {
    return new IndexBuffer(this, array, dynamicDraw);
  }

  createVertexBuffer(array, attributes, dynamicDraw) {
    return new VertexBuffer(this, array, attributes, dynamicDraw);
  }

  createRenderbuffer(storageFormat, width, height) {
    const gl = this.gl;

    const rbo = gl.createRenderbuffer();
    this.bindRenderbuffer.set(rbo);
    gl.renderbufferStorage(gl.RENDERBUFFER, storageFormat, width, height);
    this.bindRenderbuffer.set(null);

    return rbo;
  }

  createFramebuffer(width, height) {
    return new Framebuffer(this, width, height);
  }

  clear({ color, depth }) {
    const gl = this.gl;
    let mask = 0;

    if (color) {
      mask |= gl.COLOR_BUFFER_BIT;
      this.clearColor.set(color);
      this.colorMask.set([true, true, true, true]);
    }

    if (typeof depth !== 'undefined') {
      mask |= gl.DEPTH_BUFFER_BIT;

      // Workaround for platforms where clearDepth doesn't seem to work
      // without reseting the depthRange. See https://github.com/mapbox/mapbox-gl-js/issues/3437
      this.depthRange.set([0, 1]);

      this.clearDepth.set(depth);
      this.depthMask.set(true);
    }

    // See note in Painter#clearStencil: implement this the easy way once GPU bug/workaround is fixed upstream
    // if (typeof stencil !== 'undefined') {
    //     mask |= gl.STENCIL_BUFFER_BIT;
    //     this.clearStencil.set(stencil);
    //     this.stencilMask.set(0xFF);
    // }

    gl.clear(mask);
  }

  setCullFace(cullFaceMode) {
    if (cullFaceMode.enable === false) {
      this.cullFace.set(false);
    } else {
      this.cullFace.set(true);
      this.cullFaceSide.set(cullFaceMode.mode);
      this.frontFace.set(cullFaceMode.frontFace);
    }
  }

  setDepthMode(depthMode) {
    if (depthMode.func === this.gl.ALWAYS && !depthMode.mask) {
      this.depthTest.set(false);
    } else {
      this.depthTest.set(true);
      this.depthFunc.set(depthMode.func);
      this.depthMask.set(depthMode.mask);
      this.depthRange.set(depthMode.range);
    }
  }

  setStencilMode(stencilMode) {
    if (stencilMode.test.func === this.gl.ALWAYS && !stencilMode.mask) {
      this.stencilTest.set(false);
    } else {
      this.stencilTest.set(true);
      this.stencilMask.set(stencilMode.mask);
      this.stencilOp.set([stencilMode.fail, stencilMode.depthFail, stencilMode.pass]);
      this.stencilFunc.set({
        func: stencilMode.test.func,
        ref: stencilMode.ref,
        mask: stencilMode.test.mask
      });
    }
  }

  setColorMode(colorMode) {
    if (deepEqual(colorMode.blendFunction, ColorMode.Replace)) {
      this.blend.set(false);
    } else {
      this.blend.set(true);
      this.blendFunc.set(colorMode.blendFunction);
      this.blendColor.set(colorMode.blendColor);
    }

    this.colorMask.set(colorMode.mask);
  }
}

export default Context;
