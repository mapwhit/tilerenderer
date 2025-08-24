// Note: all "sizes" are measured in bytes

import assert from 'assert';

export const viewTypes = {
  Int8: Int8Array,
  Uint8: Uint8Array,
  Int16: Int16Array,
  Uint16: Uint16Array,
  Int32: Int32Array,
  Uint32: Uint32Array,
  Float32: Float32Array
};

/**
 * @private
 */
export class Struct {
  // The following properties are defined on the prototype of sub classes.

  /**
   * @param {StructArray} structArray The StructArray the struct is stored in
   * @param {number} index The index of the struct in the StructArray.
   * @private
   */
  constructor(structArray, index) {
    this._structArray = structArray;
    this._pos1 = index * this.size;
    this._pos2 = this._pos1 / 2;
    this._pos4 = this._pos1 / 4;
    this._pos8 = this._pos1 / 8;
  }
}

const DEFAULT_CAPACITY = 128;
const RESIZE_MULTIPLIER = 5;

/**
 * `StructArray` provides an abstraction over `ArrayBuffer` and `TypedArray`
 * making it behave like an array of typed structs.
 *
 * Conceptually, a StructArray is comprised of elements, i.e., instances of its
 * associated struct type. Each particular struct type, together with an
 * alignment size, determines the memory layout of a StructArray whose elements
 * are of that type.  Thus, for each such layout that we need, we have
 * a corrseponding StructArrayLayout class, inheriting from StructArray and
 * implementing `emplaceBack()` and `_refreshViews()`.
 *
 * In some cases, where we need to access particular elements of a StructArray,
 * we implement a more specific subclass that inherits from one of the
 * StructArrayLayouts and adds a `get(i): T` accessor that returns a structured
 * object whose properties are proxies into the underlying memory space for the
 * i-th element.  This affords the convience of working with (seemingly) plain
 * Javascript objects without the overhead of serializing/deserializing them
 * into ArrayBuffers for efficient web worker transfer.
 *
 * @private
 */
export class StructArray {
  // The following properties are defined on the prototype.

  constructor() {
    this.capacity = -1;
    this.resize(0);
  }

  /**
   * Resize the array to discard unused capacity.
   */
  _trim() {
    if (this.length !== this.capacity) {
      this.capacity = this.length;
      this.arrayBuffer = this.arrayBuffer.slice(0, this.length * this.bytesPerElement);
      this._refreshViews();
    }
  }

  /**
   * Resets the the length of the array to 0 without de-allocating capcacity.
   */
  clear() {
    this.length = 0;
  }

  /**
   * Resize the array.
   * If `n` is greater than the current length then additional elements with undefined values are added.
   * If `n` is less than the current length then the array will be reduced to the first `n` elements.
   * @param {number} n The new size of the array.
   */
  resize(n) {
    this.reserve(n);
    this.length = n;
  }

  /**
   * Indicate a planned increase in size, so that any necessary allocation may
   * be done once, ahead of time.
   * @param {number} n The expected size of the array.
   */
  reserve(n) {
    if (n > this.capacity) {
      this.capacity = Math.max(n, Math.floor(this.capacity * RESIZE_MULTIPLIER), DEFAULT_CAPACITY);
      this.arrayBuffer = new ArrayBuffer(this.capacity * this.bytesPerElement);

      const oldUint8Array = this.uint8;
      this._refreshViews();
      if (oldUint8Array) {
        this.uint8.set(oldUint8Array);
      }
    }
  }

  /**
   * Create TypedArray views for the current ArrayBuffer.
   */
  _refreshViews() {
    throw new Error('_refreshViews() must be implemented by each concrete StructArray layout');
  }
}

/**
 * Given a list of member fields, create a full StructArrayLayout, in
 * particular calculating the correct byte offset for each field.  This data
 * is used at build time to generate StructArrayLayout_*#emplaceBack() and
 * other accessors, and at runtime for binding vertex buffer attributes.
 *
 * @private
 */
export function createLayout(members, alignment = 1) {
  let offset = 0;
  let maxSize = 0;
  const layoutMembers = members.map(member => {
    assert(member.name.length);
    const typeSize = sizeOf(member.type);
    const memberOffset = (offset = align(offset, Math.max(alignment, typeSize)));
    const components = member.components || 1;

    maxSize = Math.max(maxSize, typeSize);
    offset += typeSize * components;

    return {
      name: member.name,
      type: member.type,
      components: components,
      offset: memberOffset
    };
  });

  const size = align(offset, Math.max(maxSize, alignment));

  return {
    members: layoutMembers,
    size,
    alignment
  };
}

function sizeOf(type) {
  return viewTypes[type].BYTES_PER_ELEMENT;
}

function align(offset, size) {
  return Math.ceil(offset / size) * size;
}
