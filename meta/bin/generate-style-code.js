import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import styleSpec from '../../src/style-spec/reference/v8.json' with { type: 'json' };

const spec = structuredClone(styleSpec);

function typeToClass(property) {
  switch (property['property-type']) {
    case 'data-driven':
      return 'DataDrivenProperty';
    case 'cross-faded':
      return 'CrossFadedProperty';
    case 'cross-faded-data-driven':
      return 'CrossFadedDataDrivenProperty';
    case 'color-ramp':
      return 'ColorRampProperty';
    case 'data-constant':
    case 'constant':
      return 'DataConstantProperty';
    default:
      throw new Error(`unknown property-type '${property['property-type']}' for ${property.name}`);
  }
}

const PROPERTY_SPEC_KEYS = new Set([
  'default',
  'expression',
  'length',
  'property-type',
  'tokens',
  'transition',
  'type',
  'value',
  'values'
]);

function getPropertySpec(property, type) {
  const spec = styleSpec[`${type}_${property.layerType}`][property.name];
  // filter out keys that are not part of the property spec
  if (spec.values) {
    // we only need the values not their properties
    spec.values = Object.keys(spec.values);
  }
  if (spec.transition === false) {
    // we don't need the transition flag if it's false
    delete spec.transition;
  }
  if (spec.expression?.interpolated === false) {
    // we don't need the interpolated flag if it's false
    delete spec.expression.interpolated;
  }
  if (spec['property-type'] !== 'constant') {
    // all other property types are set by property classes
    delete spec['property-type'];
  }
  return Object.fromEntries(Object.entries(spec).filter(([key]) => PROPERTY_SPEC_KEYS.has(key)));
}

function propertyValue(property, type) {
  const klass = typeToClass(property);
  const propertySpec = getPropertySpec(property, type);
  return `new ${klass}(${JSON.stringify(propertySpec)})`;
}

const propertiesJs = ejs.compile(fs.readFileSync(resolve('../layout/layer_properties.js.ejs'), 'utf8'), {
  strict: true
});

const layers = Object.keys(spec.layer.type.values).map(type => {
  const layoutProperties = Object.keys(spec[`layout_${type}`]).reduce((memo, name) => {
    if (name !== 'visibility') {
      spec[`layout_${type}`][name].name = name;
      spec[`layout_${type}`][name].layerType = type;
      memo.push(spec[`layout_${type}`][name]);
    }
    return memo;
  }, []);

  const paintProperties = Object.keys(spec[`paint_${type}`]).reduce((memo, name) => {
    spec[`paint_${type}`][name].name = name;
    spec[`paint_${type}`][name].layerType = type;
    memo.push(spec[`paint_${type}`][name]);
    return memo;
  }, []);

  const klasses = new Set([...layoutProperties, ...paintProperties].map(typeToClass));

  return {
    type,
    layoutProperties,
    paintProperties,
    klasses: Array.from(klasses).sort(),
    propertyValue
  };
});

for (const layer of layers) {
  fs.writeFileSync(
    resolve(`../../src/style/style_layer/${layer.type.replace('-', '_')}_style_layer_properties.js`),
    propertiesJs(layer)
  );
}

function resolve(file) {
  return path.resolve(import.meta.dirname, file);
}
