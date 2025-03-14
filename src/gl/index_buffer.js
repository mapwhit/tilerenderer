const assert = require('assert');

class IndexBuffer {
  constructor(context, array, dynamicDraw) {
    this.context = context;
    const gl = context.gl;
    this.buffer = gl.createBuffer();
    this.dynamicDraw = Boolean(dynamicDraw);

    this.unbindVAO();

    context.bindElementBuffer.set(this.buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

    if (!this.dynamicDraw) {
      delete array.arrayBuffer;
    }
  }

  unbindVAO() {
    // The bound index buffer is part of vertex array object state. We don't want to
    // modify whatever VAO happens to be currently bound, so make sure the default
    // vertex array provided by the context is bound instead.
    if (this.context.extVertexArrayObject) {
      this.context.bindVertexArrayOES.set(null);
    }
  }

  bind() {
    this.context.bindElementBuffer.set(this.buffer);
  }

  updateData(array) {
    const gl = this.context.gl;
    assert(this.dynamicDraw);
    // The right VAO will get this buffer re-bound later in VertexArrayObject#bind
    // See https://github.com/mapbox/mapbox-gl-js/issues/5620
    this.unbindVAO();
    this.bind();
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, array.arrayBuffer);
  }

  destroy() {
    const gl = this.context.gl;
    if (this.buffer) {
      gl.deleteBuffer(this.buffer);
      delete this.buffer;
    }
  }
}

module.exports = IndexBuffer;
