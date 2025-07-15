/*
 * Compute the difference between the keys in one object and the keys
 * in another object.
 *
 * @returns keys difference
 * @private
 */
function keysDifference(obj, other) {
  const difference = [];
  for (const i in obj) {
    if (!(i in other)) {
      difference.push(i);
    }
  }
  return difference;
}

/**
 * Given an object and a number of properties as strings, return version
 * of that object with only those properties.
 *
 * @param src the object
 * @param properties an array of property names chosen
 * to appear on the resulting object.
 * @returns object with limited properties.
 * @example
 * var foo = { name: 'Charlie', age: 10 };
 * var justName = pick(foo, ['name']);
 * // justName = { name: 'Charlie' }
 * @private
 */
function pick(src, properties) {
  const entries = properties.filter(p => p in src).map(p => [p, src[p]]);
  return Object.fromEntries(entries);
}

/**
 * Given an array of member function names as strings, replace all of them
 * with bound versions that will always refer to `context` as `this`. This
 * is useful for classes where otherwise event bindings would reassign
 * `this` to the evented object or some other value: this lets you ensure
 * the `this` value always.
 *
 * @param fns list of member function names
 * @param context the context value
 * @example
 * function MyClass() {
 *   bindAll(['ontimer'], this);
 *   this.name = 'Tom';
 * }
 * MyClass.prototype.ontimer = function() {
 *   alert(this.name);
 * };
 * var myClass = new MyClass();
 * setTimeout(myClass.ontimer, 100);
 * @private
 */
function bindAll(fns, context) {
  fns.forEach(fn => {
    if (!context[fn]) {
      return;
    }
    context[fn] = context[fn].bind(context);
  });
}

/**
 * Create an object by mapping all the values of an existing object while
 * preserving their keys.
 *
 * @private
 */
function mapObject(input, iterator, context) {
  context ??= this;
  const entries = Object.entries(input).map(([k, v]) => [k, iterator.call(context, v, k, input)]);
  return Object.fromEntries(entries);
}

/**
 * Create an object by filtering out values of an existing object.
 *
 * @private
 */
function filterObject(input, iterator, context) {
  context ??= this;
  const entries = Object.entries(input).filter(([k, v]) => iterator.call(context, v, k, input));
  return Object.fromEntries(entries);
}

/**
 * Deeply compares two object literals.
 *
 * @private
 */
function deepEqual(a, b) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && a !== null && b !== null) {
    if (!(typeof b === 'object')) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const key in a) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return a === b;
}

/**
 * Deeply clones two objects.
 *
 * @private
 */
function clone(input) {
  if (Array.isArray(input)) {
    return input.map(clone);
  }
  if (typeof input === 'object' && input) {
    return mapObject(input, clone);
  }
  return input;
}

/**
 * Check if two arrays have at least one common element.
 *
 * @private
 */
function arraysIntersect(a, b) {
  for (let l = 0; l < a.length; l++) {
    if (b.indexOf(a[l]) >= 0) return true;
  }
  return false;
}

module.exports = {
  keysDifference,
  pick,
  bindAll,
  mapObject,
  filterObject,
  deepEqual,
  clone,
  arraysIntersect
};
