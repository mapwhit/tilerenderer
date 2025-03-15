const assert = require('assert');

module.exports = {
  register,
  serialize,
  deserialize
};

const registry = new Map();

/**
 * Register the given class as serializable.
 *
 * @param options
 * @param options.omit List of properties to omit from serialization (e.g., cached/computed properties)
 * @param options.shallow List of properties that should be serialized by a simple shallow copy, rather than by a recursive call to serialize().
 *
 * @private
 */
function register(name, klass, { omit, shallow } = {}) {
  assert(!registry.has(name), `${name} is already registered.`);
  Object.defineProperty(klass, '_classRegistryKey', {
    value: name,
    writeable: false
  });
  registry.set(name, { klass, omit, shallow });
}

register('Object', Object);

/**
 * Serialize the given object for transfer to or from a web worker.
 *
 * For non-builtin types, recursively serialize each property (possibly
 * omitting certain properties - see register()), and package the result along
 * with the constructor's `name` so that the appropriate constructor can be
 * looked up in `deserialize()`.
 *
 * If a `transferables` array is provided, add any transferable objects (i.e.,
 * any ArrayBuffers or ArrayBuffer views) to the list. (If a copy is needed,
 * this should happen in the client code, before using serialize().)
 *
 * @private
 */
function serialize(input, transferables) {
  if (isSerializablePrimitive(input)) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    transferables?.push(input);
    return input;
  }

  if (ArrayBuffer.isView(input)) {
    transferables?.push(input.buffer);
    return input;
  }

  if (input instanceof ImageData) {
    transferables?.push(input.data.buffer);
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => serialize(item, transferables));
  }

  if (typeof input === 'object') {
    const klass = input.constructor;
    const name = klass._classRegistryKey;
    if (!name) {
      throw new Error(`can't serialize object of unregistered class`);
    }
    assert(registry.has(name));

    // (Temporary workaround) allow a class to provide static
    // `serialize()` and `deserialize()` methods to bypass the generic
    // approach.
    // This temporary workaround lets us use the generic serialization
    // approach for objects whose members include instances of dynamic
    // StructArray types. Once we refactor StructArray to be static,
    // we can remove this complexity.
    const properties = klass.serialize ? klass.serialize(input, transferables) : {};

    if (!klass.serialize) {
      const { omit, shallow } = registry.get(name);
      for (const key in input) {
        if (!Object.hasOwn(input, key)) continue;
        if (omit?.includes(key)) continue;
        const value = input[key];
        properties[key] = shallow?.includes(key) ? value : serialize(value, transferables);
      }
      if (input instanceof Error) {
        properties.message = input.message;
      }
    } else {
      // make sure statically serialized object survives transfer of $name property
      assert(!transferables || properties !== transferables[transferables.length - 1]);
    }

    if (properties.$name) {
      throw new Error('$name property is reserved for worker serialization logic.');
    }
    if (name !== 'Object') {
      properties.$name = name;
    }

    return properties;
  }

  throw new Error(`can't serialize object of type ${typeof input}`);
}

function deserialize(input) {
  if (
    isSerializablePrimitive(input) ||
    input instanceof ArrayBuffer ||
    ArrayBuffer.isView(input) ||
    input instanceof ImageData
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(deserialize);
  }

  if (typeof input === 'object') {
    const name = input.$name ?? 'Object';

    const { klass, shallow } = registry.get(name);
    if (!klass) {
      throw new Error(`can't deserialize unregistered class ${name}`);
    }

    if (klass.deserialize) {
      return klass.deserialize(input);
    }

    const result = Object.create(klass.prototype);

    for (const key of Object.keys(input)) {
      if (key === '$name') continue;
      const value = input[key];
      result[key] = shallow?.includes(key) ? value : deserialize(value);
    }

    return result;
  }

  throw new Error(`can't deserialize object of type ${typeof input}`);
}

function isSerializablePrimitive(input) {
  return (
    input == null ||
    typeof input === 'boolean' ||
    typeof input === 'number' ||
    typeof input === 'string' ||
    input instanceof Date ||
    input instanceof RegExp ||
    input instanceof Boolean ||
    input instanceof Number ||
    input instanceof String
  );
}
