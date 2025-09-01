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
export function bindAll(fns, context) {
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
export function mapObject(input, iterator, context) {
  context ??= this;
  const entries = Object.entries(input).map(([k, v]) => [k, iterator.call(context, v, k, input)]);
  return Object.fromEntries(entries);
}

/**
 * Deeply compares two object literals.
 *
 * @private
 */
export function deepEqual(a, b) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  if (typeof a === 'object' && a !== null && b !== null) {
    if (!(typeof b === 'object')) {
      return false;
    }
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
      return false;
    }
    for (const key in a) {
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return a === b;
}

/**
 * Check if two arrays have at least one common element.
 *
 * @private
 */
export function arraysIntersect(a, b) {
  for (let l = 0; l < a.length; l++) {
    if (b.indexOf(a[l]) >= 0) {
      return true;
    }
  }
  return false;
}
