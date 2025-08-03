const { packUint8ToFloat } = require('../shaders/encode_attribute');
const { supportsPropertyExpression } = require('@mapwhit/style-expressions');
const { register } = require('../util/transfer_registry');
const { PossiblyEvaluatedPropertyValue } = require('../style/properties');
const {
  StructArrayLayout1f4,
  StructArrayLayout2f8,
  StructArrayLayout4f16,
  PatternLayoutArray
} = require('./array_types');
const EvaluationParameters = require('../style/evaluation_parameters');
const { Uniform1f, UniformColor, Uniform4f } = require('../render/uniform_binding');

function packColor(color) {
  return [packUint8ToFloat(255 * color.r, 255 * color.g), packUint8ToFloat(255 * color.b, 255 * color.a)];
}

/**
 *  `Binder` is the interface definition for the strategies for constructing,
 *  uploading, and binding paint property data as GLSL attributes. Most style-
 *  spec properties have a 1:1 relationship to shader attribute/uniforms, but
 *  some require multliple values per feature to be passed to the GPU, and in
 *  those cases we bind multiple attributes/uniforms.
 *
 *  It has three implementations, one for each of the three strategies we use:
 *
 *  * For _constant_ properties -- those whose value is a constant, or the constant
 *    result of evaluating a camera expression at a particular camera position -- we
 *    don't need a vertex attribute buffer, and instead use a uniform.
 *  * For data expressions, we use a vertex buffer with a single attribute value,
 *    the evaluated result of the source function for the given feature.
 *  * For composite expressions, we use a vertex buffer with two attributes: min and
 *    max values covering the range of zooms at which we expect the tile to be
 *    displayed. These values are calculated by evaluating the composite expression for
 *    the given feature at strategically chosen zoom levels. In addition to this
 *    attribute data, we also use a uniform value which the shader uses to interpolate
 *    between the min and max value at the final displayed zoom level. The use of a
 *    uniform allows us to cheaply update the value on every frame.
 *
 *  Note that the shader source varies depending on whether we're using a uniform or
 *  attribute. We dynamically compile shaders at runtime to accomodate this.
 *
 * @private
 */

class ConstantBinder {
  constructor(value, names, type) {
    this.value = value;
    this.names = names;
    this.uniformNames = this.names.map(name => `u_${name}`);
    this.type = type;
    this.maxValue = Number.NEGATIVE_INFINITY;
  }

  defines() {
    return this.names.map(name => `#define HAS_UNIFORM_u_${name}`);
  }

  setConstantPatternPositions() {}
  populatePaintArray() {}
  updatePaintArray() {}
  upload() {}
  destroy() {}

  setUniforms(context, uniform, globals, currentValue) {
    uniform.set(currentValue.constantOr(this.value));
  }

  getBinding(context, location) {
    return this.type === 'color' ? new UniformColor(context, location) : new Uniform1f(context, location);
  }
}

class CrossFadedConstantBinder {
  constructor(value, names, type) {
    this.value = value;
    this.names = names;
    this.uniformNames = this.names.map(name => `u_${name}`);
    this.type = type;
    this.maxValue = Number.NEGATIVE_INFINITY;
    this.patternPositions = { patternTo: null, patternFrom: null };
  }

  defines() {
    return this.names.map(name => `#define HAS_UNIFORM_u_${name}`);
  }

  populatePaintArray() {}
  updatePaintArray() {}
  upload() {}
  destroy() {}

  setConstantPatternPositions(posTo, posFrom) {
    this.patternPositions.patternTo = posTo.tlbr;
    this.patternPositions.patternFrom = posFrom.tlbr;
  }

  setUniforms(context, uniform, globals, currentValue, uniformName) {
    const pos = this.patternPositions;
    if (uniformName === 'u_pattern_to' && pos.patternTo) uniform.set(pos.patternTo);
    if (uniformName === 'u_pattern_from' && pos.patternFrom) uniform.set(pos.patternFrom);
  }

  getBinding(context, location) {
    return new Uniform4f(context, location);
  }
}

class SourceExpressionBinder {
  constructor(expression, names, type, PaintVertexArray) {
    this.expression = expression;
    this.names = names;
    this.type = type;
    this.uniformNames = this.names.map(name => `a_${name}`);
    this.maxValue = Number.NEGATIVE_INFINITY;
    this.paintVertexAttributes = names.map(name => ({
      name: `a_${name}`,
      type: 'Float32',
      components: type === 'color' ? 2 : 1,
      offset: 0
    }));
    this.paintVertexArray = new PaintVertexArray();
  }

  defines() {
    return [];
  }

  setConstantPatternPositions() {}

  populatePaintArray(newLength, feature, imagePositions, options) {
    const paintArray = this.paintVertexArray;

    const start = paintArray.length;
    paintArray.reserve(newLength);

    const value = this.expression.evaluate(new EvaluationParameters(0, options), feature, {});

    if (this.type === 'color') {
      const color = packColor(value);
      for (let i = start; i < newLength; i++) {
        paintArray.emplaceBack(color[0], color[1]);
      }
    } else {
      for (let i = start; i < newLength; i++) {
        paintArray.emplaceBack(value);
      }

      this.maxValue = Math.max(this.maxValue, value);
    }
  }

  updatePaintArray(start, end, feature, featureState, imagePositions) {
    const paintArray = this.paintVertexArray;
    const value = this.expression.evaluate({ zoom: 0 }, feature, featureState);

    if (this.type === 'color') {
      const color = packColor(value);
      for (let i = start; i < end; i++) {
        paintArray.emplace(i, color[0], color[1]);
      }
    } else {
      for (let i = start; i < end; i++) {
        paintArray.emplace(i, value);
      }

      this.maxValue = Math.max(this.maxValue, value);
    }
  }

  upload(context) {
    if (this.paintVertexArray?.arrayBuffer) {
      if (this.paintVertexBuffer?.buffer) {
        this.paintVertexBuffer.updateData(this.paintVertexArray);
      } else {
        this.paintVertexBuffer = context.createVertexBuffer(
          this.paintVertexArray,
          this.paintVertexAttributes,
          this.expression.isStateDependent
        );
      }
    }
  }

  destroy() {
    if (this.paintVertexBuffer) {
      this.paintVertexBuffer.destroy();
    }
  }

  setUniforms(context, uniform) {
    uniform.set(0);
  }

  getBinding(context, location) {
    return new Uniform1f(context, location);
  }
}

class CompositeExpressionBinder {
  constructor(expression, names, type, useIntegerZoom, zoom, layout) {
    this.expression = expression;
    this.names = names;
    this.uniformNames = this.names.map(name => `a_${name}_t`);
    this.type = type;
    this.useIntegerZoom = useIntegerZoom;
    this.zoom = zoom;
    this.maxValue = Number.NEGATIVE_INFINITY;
    const PaintVertexArray = layout;
    this.paintVertexAttributes = names.map(name => {
      return {
        name: `a_${name}`,
        type: 'Float32',
        components: type === 'color' ? 4 : 2,
        offset: 0
      };
    });
    this.paintVertexArray = new PaintVertexArray();
  }

  defines() {
    return [];
  }

  setConstantPatternPositions() {}

  populatePaintArray(newLength, feature, imagePositions, options) {
    const paintArray = this.paintVertexArray;

    const start = paintArray.length;
    paintArray.reserve(newLength);

    const min = this.expression.evaluate(new EvaluationParameters(this.zoom, options), feature, {});
    const max = this.expression.evaluate(new EvaluationParameters(this.zoom + 1, options), feature, {});

    if (this.type === 'color') {
      const minColor = packColor(min);
      const maxColor = packColor(max);
      for (let i = start; i < newLength; i++) {
        paintArray.emplaceBack(minColor[0], minColor[1], maxColor[0], maxColor[1]);
      }
    } else {
      for (let i = start; i < newLength; i++) {
        paintArray.emplaceBack(min, max);
      }
      this.maxValue = Math.max(this.maxValue, min, max);
    }
  }

  updatePaintArray(start, end, feature, featureState) {
    const paintArray = this.paintVertexArray;

    const min = this.expression.evaluate({ zoom: this.zoom }, feature, featureState);
    const max = this.expression.evaluate({ zoom: this.zoom + 1 }, feature, featureState);

    if (this.type === 'color') {
      const minColor = packColor(min);
      const maxColor = packColor(max);
      for (let i = start; i < end; i++) {
        paintArray.emplace(i, minColor[0], minColor[1], maxColor[0], maxColor[1]);
      }
    } else {
      for (let i = start; i < end; i++) {
        paintArray.emplace(i, min, max);
      }
      this.maxValue = Math.max(this.maxValue, min, max);
    }
  }

  upload(context) {
    if (this.paintVertexArray?.arrayBuffer) {
      if (this.paintVertexBuffer?.buffer) {
        this.paintVertexBuffer.updateData(this.paintVertexArray);
      } else {
        this.paintVertexBuffer = context.createVertexBuffer(
          this.paintVertexArray,
          this.paintVertexAttributes,
          this.expression.isStateDependent
        );
      }
    }
  }

  destroy() {
    if (this.paintVertexBuffer) {
      this.paintVertexBuffer.destroy();
    }
  }

  interpolationFactor(currentZoom) {
    if (this.useIntegerZoom) {
      return this.expression.interpolationFactor(Math.floor(currentZoom), this.zoom, this.zoom + 1);
    }
    return this.expression.interpolationFactor(currentZoom, this.zoom, this.zoom + 1);
  }

  setUniforms(context, uniform, globals) {
    uniform.set(this.interpolationFactor(globals.zoom));
  }

  getBinding(context, location) {
    return new Uniform1f(context, location);
  }
}

class CrossFadedCompositeBinder {
  constructor(expression, names, type, useIntegerZoom, zoom, PaintVertexArray, layerId) {
    this.expression = expression;
    this.names = names;
    this.type = type;
    this.uniformNames = this.names.map(name => `a_${name}_t`);
    this.useIntegerZoom = useIntegerZoom;
    this.zoom = zoom;
    this.maxValue = Number.NEGATIVE_INFINITY;
    this.layerId = layerId;

    this.paintVertexAttributes = names.map(name => ({
      name: `a_${name}`,
      type: 'Uint16',
      components: 4,
      offset: 0
    }));

    this.zoomInPaintVertexArray = new PaintVertexArray();
    this.zoomOutPaintVertexArray = new PaintVertexArray();
  }

  defines() {
    return [];
  }

  setConstantPatternPositions() {}

  populatePaintArray(length, feature, imagePositions) {
    // We populate two paint arrays because, for cross-faded properties, we don't know which direction
    // we're cross-fading to at layout time. In order to keep vertex attributes to a minimum and not pass
    // unnecessary vertex data to the shaders, we determine which to upload at draw time.

    const zoomInArray = this.zoomInPaintVertexArray;
    const zoomOutArray = this.zoomOutPaintVertexArray;
    const { layerId } = this;
    const start = zoomInArray.length;

    zoomInArray.reserve(length);
    zoomOutArray.reserve(length);

    if (imagePositions && feature.patterns && feature.patterns[layerId]) {
      const { min, mid, max } = feature.patterns[layerId];

      const imageMin = imagePositions[min];
      const imageMid = imagePositions[mid];
      const imageMax = imagePositions[max];

      if (!imageMin || !imageMid || !imageMax) return;

      for (let i = start; i < length; i++) {
        zoomInArray.emplaceBack(
          imageMid.tl[0],
          imageMid.tl[1],
          imageMid.br[0],
          imageMid.br[1],
          imageMin.tl[0],
          imageMin.tl[1],
          imageMin.br[0],
          imageMin.br[1]
        );

        zoomOutArray.emplaceBack(
          imageMid.tl[0],
          imageMid.tl[1],
          imageMid.br[0],
          imageMid.br[1],
          imageMax.tl[0],
          imageMax.tl[1],
          imageMax.br[0],
          imageMax.br[1]
        );
      }
    }
  }

  updatePaintArray(start, end, feature, featureState, imagePositions) {
    // We populate two paint arrays because, for cross-faded properties, we don't know which direction
    // we're cross-fading to at layout time. In order to keep vertex attributes to a minimum and not pass
    // unnecessary vertex data to the shaders, we determine which to upload at draw time.

    const zoomInArray = this.zoomInPaintVertexArray;
    const zoomOutArray = this.zoomOutPaintVertexArray;
    const { layerId } = this;

    if (imagePositions && feature.patterns && feature.patterns[layerId]) {
      const { min, mid, max } = feature.patterns[layerId];
      const imageMin = imagePositions[min];
      const imageMid = imagePositions[mid];
      const imageMax = imagePositions[max];

      if (!imageMin || !imageMid || !imageMax) return;
      for (let i = start; i < end; i++) {
        zoomInArray.emplace(
          i,
          imageMid.tl[0],
          imageMid.tl[1],
          imageMid.br[0],
          imageMid.br[1],
          imageMin.tl[0],
          imageMin.tl[1],
          imageMin.br[0],
          imageMin.br[1]
        );

        zoomOutArray.emplace(
          i,
          imageMid.tl[0],
          imageMid.tl[1],
          imageMid.br[0],
          imageMid.br[1],
          imageMax.tl[0],
          imageMax.tl[1],
          imageMax.br[0],
          imageMax.br[1]
        );
      }
    }
  }

  upload(context) {
    if (this.zoomInPaintVertexArray?.arrayBuffer && this.zoomOutPaintVertexArray?.arrayBuffer) {
      this.zoomInPaintVertexBuffer = context.createVertexBuffer(
        this.zoomInPaintVertexArray,
        this.paintVertexAttributes,
        this.expression.isStateDependent
      );
      this.zoomOutPaintVertexBuffer = context.createVertexBuffer(
        this.zoomOutPaintVertexArray,
        this.paintVertexAttributes,
        this.expression.isStateDependent
      );
    }
  }

  destroy() {
    if (this.zoomOutPaintVertexBuffer) this.zoomOutPaintVertexBuffer.destroy();
    if (this.zoomInPaintVertexBuffer) this.zoomInPaintVertexBuffer.destroy();
  }

  setUniforms(context, uniform) {
    uniform.set(0);
  }

  getBinding(context, location) {
    return new Uniform1f(context, location);
  }
}

/**
 * ProgramConfiguration contains the logic for binding style layer properties and tile
 * layer feature data into GL program uniforms and vertex attributes.
 *
 * Non-data-driven property values are bound to shader uniforms. Data-driven property
 * values are bound to vertex attributes. In order to support a uniform GLSL syntax over
 * both, [Mapbox GL Shaders](https://github.com/mapbox/mapbox-gl-shaders) defines a `#pragma`
 * abstraction, which ProgramConfiguration is responsible for implementing. At runtime,
 * it examines the attributes of a particular layer, combines this with fixed knowledge
 * about how layers of the particular type are implemented, and determines which uniforms
 * and vertex attributes will be required. It can then substitute the appropriate text
 * into the shader source code, create and link a program, and bind the uniforms and
 * vertex attributes in preparation for drawing.
 *
 * When a vector tile is parsed, this same configuration information is used to
 * populate the attribute buffers needed for data-driven styling using the zoom
 * level and feature property data.
 *
 * @private
 */
class ProgramConfiguration {
  constructor() {
    this.binders = {};
    this.cacheKey = '';

    this._buffers = [];
    this._idMap = {};
    this._bufferOffset = 0;
  }

  static createDynamic(layer, zoom, filterProperties) {
    const self = new ProgramConfiguration();
    const keys = [];

    for (const property in layer.paint._values) {
      if (!filterProperties(property)) continue;
      const value = layer.paint.get(property);
      if (
        !(value instanceof PossiblyEvaluatedPropertyValue) ||
        !supportsPropertyExpression(value.property.specification)
      ) {
        continue;
      }
      const names = paintAttributeNames(property, layer.type);
      const type = value.property.specification.type;
      const useIntegerZoom = value.property.useIntegerZoom;

      const isCrossFaded =
        value.property.specification['property-type'] === 'cross-faded' ||
        value.property.specification['property-type'] === 'cross-faded-data-driven';

      if (isCrossFaded) {
        if (value.value.kind === 'constant') {
          self.binders[property] = new CrossFadedConstantBinder(value.value.value, names, type);
          keys.push(`/u_${property}`);
        } else {
          const StructArrayLayout = layoutType(property, type, 'source');
          self.binders[property] = new CrossFadedCompositeBinder(
            value.value,
            names,
            type,
            useIntegerZoom,
            zoom,
            StructArrayLayout,
            layer.id
          );
          keys.push(`/a_${property}`);
        }
      } else if (value.value.kind === 'constant') {
        self.binders[property] = new ConstantBinder(value.value.value, names, type);
        keys.push(`/u_${property}`);
      } else if (value.value.kind === 'source') {
        const StructArrayLayout = layoutType(property, type, 'source');
        self.binders[property] = new SourceExpressionBinder(value.value, names, type, StructArrayLayout);
        keys.push(`/a_${property}`);
      } else {
        const StructArrayLayout = layoutType(property, type, 'composite');
        self.binders[property] = new CompositeExpressionBinder(
          value.value,
          names,
          type,
          useIntegerZoom,
          zoom,
          StructArrayLayout
        );
        keys.push(`/z_${property}`);
      }
    }

    self.cacheKey = keys.sort().join('');

    return self;
  }

  populatePaintArrays(newLength, feature, index, imagePositions, options) {
    for (const property in this.binders) {
      const binder = this.binders[property];
      binder.populatePaintArray(newLength, feature, imagePositions, options);
    }
    if (feature.id !== undefined) {
      const featureId = String(feature.id);
      this._idMap[featureId] = this._idMap[featureId] || [];
      this._idMap[featureId].push({
        index: index,
        start: this._bufferOffset,
        end: newLength
      });
    }

    this._bufferOffset = newLength;
  }

  setConstantPatternPositions(posTo, posFrom) {
    for (const property in this.binders) {
      const binder = this.binders[property];
      binder.setConstantPatternPositions(posTo, posFrom);
    }
  }

  updatePaintArrays(featureStates, vtLayer, layer, imagePositions) {
    let dirty = false;
    for (const id in featureStates) {
      const posArray = this._idMap[id];
      if (!posArray) continue;

      const featureState = featureStates[id];
      for (const pos of posArray) {
        const feature = vtLayer.feature(pos.index);

        for (const property in this.binders) {
          const binder = this.binders[property];
          if (binder instanceof ConstantBinder || binder instanceof CrossFadedConstantBinder) continue;
          if (binder.expression.isStateDependent === true) {
            //AHM: Remove after https://github.com/mapbox/mapbox-gl-js/issues/6255
            const value = layer.paint.get(property);
            binder.expression = value.value;
            binder.updatePaintArray(pos.start, pos.end, feature, featureState, imagePositions);
            dirty = true;
          }
        }
      }
    }
    return dirty;
  }

  defines() {
    const result = [];
    for (const property in this.binders) {
      result.push.apply(result, this.binders[property].defines());
    }
    return result;
  }

  getPaintVertexBuffers() {
    return this._buffers;
  }

  getUniforms(context, locations) {
    const result = {};
    for (const property in this.binders) {
      const binder = this.binders[property];
      for (const name of binder.uniformNames) {
        result[name] = binder.getBinding(context, locations[name]);
      }
    }
    return result;
  }

  setUniforms(context, uniformBindings, properties, globals) {
    // Uniform state bindings are owned by the Program, but we set them
    // from within the ProgramConfiguraton's binder members.

    for (const property in this.binders) {
      const binder = this.binders[property];
      for (const uniformName of binder.uniformNames) {
        binder.setUniforms(context, uniformBindings[uniformName], globals, properties.get(property), uniformName);
      }
    }
  }

  updatePatternPaintBuffers(crossfade) {
    const buffers = [];

    for (const property in this.binders) {
      const binder = this.binders[property];
      if (binder instanceof CrossFadedCompositeBinder) {
        const patternVertexBuffer =
          crossfade.fromScale === 2 ? binder.zoomInPaintVertexBuffer : binder.zoomOutPaintVertexBuffer;
        if (patternVertexBuffer) buffers.push(patternVertexBuffer);
      } else if (
        (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder) &&
        binder.paintVertexBuffer
      ) {
        buffers.push(binder.paintVertexBuffer);
      }
    }

    this._buffers = buffers;
  }

  upload(context) {
    for (const property in this.binders) {
      this.binders[property].upload(context);
    }

    const buffers = [];
    for (const property in this.binders) {
      const binder = this.binders[property];
      if (
        (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder) &&
        binder.paintVertexBuffer
      ) {
        buffers.push(binder.paintVertexBuffer);
      }
    }
    this._buffers = buffers;
  }

  destroy() {
    for (const property in this.binders) {
      this.binders[property].destroy();
    }
  }
}

class ProgramConfigurationSet {
  constructor(layoutAttributes, layers, zoom, filterProperties = () => true) {
    this.programConfigurations = {};
    for (const layer of layers) {
      this.programConfigurations[layer.id] = ProgramConfiguration.createDynamic(layer, zoom, filterProperties);
      this.programConfigurations[layer.id].layoutAttributes = layoutAttributes;
    }
    this.needsUpload = false;
  }

  populatePaintArrays(length, feature, index, imagePositions, options) {
    for (const key in this.programConfigurations) {
      this.programConfigurations[key].populatePaintArrays(length, feature, index, imagePositions, options);
    }
    this.needsUpload = true;
  }

  updatePaintArrays(featureStates, vtLayer, layers, imagePositions) {
    for (const layer of layers) {
      this.needsUpload =
        this.programConfigurations[layer.id].updatePaintArrays(featureStates, vtLayer, layer, imagePositions) ||
        this.needsUpload;
    }
  }

  get(layerId) {
    return this.programConfigurations[layerId];
  }

  upload(context) {
    if (!this.needsUpload) return;
    for (const layerId in this.programConfigurations) {
      this.programConfigurations[layerId].upload(context);
    }
    this.needsUpload = false;
  }

  destroy() {
    for (const layerId in this.programConfigurations) {
      this.programConfigurations[layerId].destroy();
    }
  }
}

// paint property arrays
function paintAttributeNames(property, type) {
  const attributeNameExceptions = {
    'text-opacity': ['opacity'],
    'icon-opacity': ['opacity'],
    'text-color': ['fill_color'],
    'icon-color': ['fill_color'],
    'text-halo-color': ['halo_color'],
    'icon-halo-color': ['halo_color'],
    'text-halo-blur': ['halo_blur'],
    'icon-halo-blur': ['halo_blur'],
    'text-halo-width': ['halo_width'],
    'icon-halo-width': ['halo_width'],
    'line-gap-width': ['gapwidth'],
    'line-pattern': ['pattern_to', 'pattern_from'],
    'fill-pattern': ['pattern_to', 'pattern_from'],
    'fill-extrusion-pattern': ['pattern_to', 'pattern_from']
  };
  return attributeNameExceptions[property] || [property.replace(`${type}-`, '').replace(/-/g, '_')];
}

function getLayoutException(property) {
  const propertyExceptions = {
    'line-pattern': {
      source: PatternLayoutArray,
      composite: PatternLayoutArray
    },
    'fill-pattern': {
      source: PatternLayoutArray,
      composite: PatternLayoutArray
    },
    'fill-extrusion-pattern': {
      source: PatternLayoutArray,
      composite: PatternLayoutArray
    }
  };

  return propertyExceptions[property];
}

function layoutType(property, type, binderType) {
  const defaultLayouts = {
    color: {
      source: StructArrayLayout2f8,
      composite: StructArrayLayout4f16
    },
    number: {
      source: StructArrayLayout1f4,
      composite: StructArrayLayout2f8
    }
  };

  const layoutException = getLayoutException(property);
  return layoutException?.[binderType] || defaultLayouts[type][binderType];
}

register('ConstantBinder', ConstantBinder);
register('CrossFadedConstantBinder', CrossFadedConstantBinder);
register('SourceExpressionBinder', SourceExpressionBinder);
register('CrossFadedCompositeBinder', CrossFadedCompositeBinder);
register('CompositeExpressionBinder', CompositeExpressionBinder);
register('ProgramConfiguration', ProgramConfiguration, { omit: ['_buffers'] });
register('ProgramConfigurationSet', ProgramConfigurationSet);

ProgramConfiguration.ProgramConfigurationSet = ProgramConfigurationSet;

module.exports = ProgramConfiguration;
