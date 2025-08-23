import assert from 'assert';
import shaders from '../shaders/index.js';
import browser from '../util/browser.js';
import VertexArrayObject from './vertex_array_object.js';

class Program {
  constructor(context, source, configuration, fixedUniforms, showOverdrawInspector) {
    const gl = context.gl;
    this.program = gl.createProgram();

    const defines = configuration.defines().concat(`#define DEVICE_PIXEL_RATIO ${browser.devicePixelRatio.toFixed(1)}`);
    if (showOverdrawInspector) {
      defines.push('#define OVERDRAW_INSPECTOR;');
    }

    const fragmentSource = defines.concat(shaders.prelude.fragmentSource, source.fragmentSource).join('\n');
    const vertexSource = defines.concat(shaders.prelude.vertexSource, source.vertexSource).join('\n');

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
    gl.attachShader(this.program, fragmentShader);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(vertexShader));
    gl.attachShader(this.program, vertexShader);

    // Manually bind layout attributes in the order defined by their
    // ProgramInterface so that we don't dynamically link an unused
    // attribute at position 0, which can cause rendering to fail for an
    // entire layer (see #4607, #4728)
    const layoutAttributes = configuration.layoutAttributes || [];
    for (let i = 0; i < layoutAttributes.length; i++) {
      gl.bindAttribLocation(this.program, i, layoutAttributes[i].name);
    }

    gl.linkProgram(this.program);
    assert(gl.getProgramParameter(this.program, gl.LINK_STATUS), gl.getProgramInfoLog(this.program));

    this.numAttributes = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);

    this.attributes = {};
    const uniformLocations = {};

    for (let i = 0; i < this.numAttributes; i++) {
      const attribute = gl.getActiveAttrib(this.program, i);
      if (attribute) {
        this.attributes[attribute.name] = gl.getAttribLocation(this.program, attribute.name);
      }
    }

    const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const uniform = gl.getActiveUniform(this.program, i);
      if (uniform) {
        uniformLocations[uniform.name] = gl.getUniformLocation(this.program, uniform.name);
      }
    }

    this.fixedUniforms = fixedUniforms(context, uniformLocations);
    this.binderUniforms = configuration.getUniforms(context, uniformLocations);
  }

  draw(
    context,
    drawMode,
    depthMode,
    stencilMode,
    colorMode,
    cullFaceMode,
    uniformValues,
    layerID,
    layoutVertexBuffer,
    indexBuffer,
    segments,
    currentProperties,
    zoom,
    configuration,
    dynamicLayoutBuffer,
    dynamicLayoutBuffer2
  ) {
    const gl = context.gl;

    context.program.set(this.program);
    context.setDepthMode(depthMode);
    context.setStencilMode(stencilMode);
    context.setColorMode(colorMode);
    context.setCullFace(cullFaceMode);

    for (const name in this.fixedUniforms) {
      this.fixedUniforms[name].set(uniformValues[name]);
    }

    if (configuration) {
      configuration.setUniforms(context, this.binderUniforms, currentProperties, { zoom });
    }

    const primitiveSize = {
      [gl.LINES]: 2,
      [gl.TRIANGLES]: 3,
      [gl.LINE_STRIP]: 1
    }[drawMode];

    for (const segment of segments.get()) {
      const vaos = segment.vaos || (segment.vaos = {});
      const vao = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

      vao.bind(
        context,
        this,
        layoutVertexBuffer,
        configuration ? configuration.getPaintVertexBuffers() : [],
        indexBuffer,
        segment.vertexOffset,
        dynamicLayoutBuffer,
        dynamicLayoutBuffer2
      );

      gl.drawElements(
        drawMode,
        segment.primitiveLength * primitiveSize,
        gl.UNSIGNED_SHORT,
        segment.primitiveOffset * primitiveSize * 2
      );
    }
  }
}

export default Program;
