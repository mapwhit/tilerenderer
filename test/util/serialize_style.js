import styleSpec from '../../src/style-spec/reference/v8.json' with { type: 'json' };
export function properties() {
  return Object.keys(styleSpec.$root);
}

export function serialize(style) {
  if (!style) {
    return;
  }
  return serializeObject(styleSpec.$root, style);
}

const types = {
  array: serializeArray,
  enum: serializeEnum,
  object: serializeObject
};

function serializeField(recipe, v, objType) {
  let { required, type, default: defaultValue } = recipe;
  if (recipe.hasOwnProperty('*') && Object.keys(recipe).length === 1) {
    recipe = recipe['*'];
    const obj = {};
    for (const [k, _v] of Object.entries(v)) {
      obj[k] = serializeField(recipe, _v);
    }
    if (isEmptyObject(obj) && !required) {
      return;
    }
    return obj;
  }
  if (Array.isArray(recipe)) {
    return trySerializeObject(recipe, v);
  }
  if (
    ((v === undefined || v === null || isEmptyObject(v)) && !required) ||
    (defaultValue !== undefined && v === defaultValue)
  ) {
    return;
  }
  if (isEmptyObject(v) && required) {
    return v;
  }
  if (styleSpec[type]) {
    if (type === 'layout' || type === 'paint') {
      const pos = styleSpec[type].indexOf(`${type}_${objType}`);
      if (pos !== -1) {
        return serializeField(styleSpec[styleSpec[type][pos]], v);
      }
    }
    return serializeField(styleSpec[type], v);
  }
  if (typeof type === 'object' || type === undefined) {
    type = 'object';
  }
  if (types[type]) {
    return types[type](recipe, v);
  }
  return v;
}

function serializeArray(recipe, v) {
  recipe = styleSpec[recipe.value] ?? (recipe.value.hasOwnProperty('type') ? recipe.value : { type: recipe.value });
  return v.map(item => serializeField(recipe, item));
}

function serializeEnum(recipe, v) {
  const { default: defaultValue, values, required } = recipe;
  if (((v === undefined || v === null) && !required) || (defaultValue !== undefined && v === defaultValue)) {
    return;
  }
  const enumValues = Array.isArray(values) ? values : Object.keys(values);
  if (enumValues.includes(v)) {
    return v;
  }
  throw new Error(`Invalid value "${JSON.stringify(v)}" for enum "${recipe.key}"`);
}

function trySerializeObject(recipe, v) {
  let obj;
  if (
    recipe.some(item => {
      try {
        obj = serializeObject(styleSpec[item], v);
        return true;
      } catch {
        return false;
      }
    })
  ) {
    return obj;
  }
  throw new Error(`Invalid value "${JSON.stringify(v)}" for "${JSON.stringify(recipe)}"`);
}

function serializeObject(recipe, v) {
  const obj = {};
  for (const [key, value] of Object.entries(recipe)) {
    if (key === '*') {
      for (const [k, _v] of Object.entries(v)) {
        if (k.charAt(0) !== '_' && !obj.hasOwnProperty(k)) {
          obj[k] = _v;
        }
      }
      continue;
    }
    const field = serializeField({ key, ...value }, v[key], obj.type);
    if (field !== undefined) {
      obj[key] = field;
    }
  }
  const { required } = recipe;
  if (isEmptyObject(obj) && !required) {
    return;
  }
  return obj;
}

function isEmptyObject(obj) {
  return typeof obj === 'object' && Object.keys(obj).length === 0;
}
