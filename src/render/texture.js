class Texture {
  constructor(context, image, format, options) {
    this.context = context;
    this.format = format;
    this.texture = context.gl.createTexture();
    this.update(image, options);
  }

  update(image, options) {
    const { width, height } = image;
    const resize = !this.size || this.size[0] !== width || this.size[1] !== height;
    const { context } = this;
    const { gl } = context;

    this.useMipmap = Boolean(options?.useMipmap);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (resize) {
      this.size = [width, height];

      context.pixelStoreUnpack.set(1);

      if (this.format === gl.RGBA && (!options || options.premultiply !== false)) {
        context.pixelStoreUnpackPremultiplyAlpha.set(true);
      }

      if (
        image instanceof HTMLImageElement ||
        image instanceof HTMLCanvasElement ||
        image instanceof HTMLVideoElement ||
        image instanceof ImageData
      ) {
        gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, image.data);
      }
    } else {
      if (
        image instanceof HTMLImageElement ||
        image instanceof HTMLCanvasElement ||
        image instanceof HTMLVideoElement ||
        image instanceof ImageData
      ) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
      }
    }

    if (this.useMipmap && this.isSizePowerOfTwo()) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
  }

  bind(filter, wrap, minFilter) {
    const { context } = this;
    const { gl } = context;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (minFilter === gl.LINEAR_MIPMAP_NEAREST && !this.isSizePowerOfTwo()) {
      minFilter = gl.LINEAR;
    }

    if (filter !== this.filter) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter || filter);
      this.filter = filter;
    }

    if (wrap !== this.wrap) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      this.wrap = wrap;
    }
  }

  isSizePowerOfTwo() {
    return this.size[0] === this.size[1] && (Math.log(this.size[0]) / Math.LN2) % 1 === 0;
  }

  destroy() {
    const { gl } = this.context;
    gl.deleteTexture(this.texture);
    this.texture = null;
  }
}

export default Texture;
