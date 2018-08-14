const assert = require('assert');

const { toString, array, ValueType, StringType, NumberType, BooleanType, checkSubtype } = require('../types');

const { typeOf } = require('../values');
const RuntimeError = require('../runtime_error');

const types = {
  string: StringType,
  number: NumberType,
  boolean: BooleanType
};

class ArrayAssertion {
  constructor(type, args) {
    this.type = type;
    this.args = args;
  }

  static parse(args, context) {
    if (args.length < 2) return context.error('Expected at least one argument.');

    let i = 1;

    let itemType;
    if (args.length > 2) {
      const type = args[1];
      if (typeof type !== 'string' || !(type in types))
        return context.error('The item type argument of "array" must be one of string, number, boolean', 1);
      itemType = types[type];
      i++;
    } else {
      itemType = ValueType;
    }

    let N;
    if (args.length > 3) {
      if (args[2] !== null && (typeof args[2] !== 'number' || args[2] < 0 || args[2] !== Math.floor(args[2]))) {
        return context.error('The length argument to "array" must be a positive integer literal', 2);
      }
      N = args[2];
      i++;
    }

    const type = array(itemType, N);

    const parsed = [];
    for (; i < args.length; i++) {
      const input = context.parse(args[i], i, ValueType);
      if (!input) return null;
      parsed.push(input);
    }

    return new ArrayAssertion(type, parsed);
  }

  evaluate(ctx) {
    for (let i = 0; i < this.args.length; i++) {
      const value = this.args[i].evaluate(ctx);
      const error = checkSubtype(this.type, typeOf(value));
      if (!error) {
        return value;
      }
      if (i === this.args.length - 1) {
        throw new RuntimeError(
          `Expected value to be of type ${toString(this.type)}, but found ${toString(typeOf(value))} instead.`
        );
      }
    }

    assert(false);
    return null;
  }

  eachChild(fn) {
    this.args.forEach(fn);
  }

  possibleOutputs() {
    return [].concat(...this.args.map(arg => arg.possibleOutputs()));
  }

  serialize() {
    const serialized = ['array'];
    const itemType = this.type.itemType;
    if (itemType.kind === 'string' || itemType.kind === 'number' || itemType.kind === 'boolean') {
      serialized.push(itemType.kind);
      const N = this.type.N;
      if (typeof N === 'number' || this.args.length > 1) {
        serialized.push(N);
      }
    }
    return serialized.concat(this.args.map(arg => arg.serialize()));
  }
}

module.exports = ArrayAssertion;
