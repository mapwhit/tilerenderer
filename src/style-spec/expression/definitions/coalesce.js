const assert = require('assert');

const { checkSubtype, ValueType } = require('../types');

class Coalesce {
  constructor(type, args) {
    this.type = type;
    this.args = args;
  }

  static parse(args, context) {
    if (args.length < 2) {
      return context.error('Expectected at least one argument.');
    }
    let outputType = null;
    const expectedType = context.expectedType;
    if (expectedType && expectedType.kind !== 'value') {
      outputType = expectedType;
    }
    const parsedArgs = [];

    for (const arg of args.slice(1)) {
      const parsed = context.parse(arg, 1 + parsedArgs.length, outputType, undefined, { typeAnnotation: 'omit' });
      if (!parsed) return null;
      outputType = outputType || parsed.type;
      parsedArgs.push(parsed);
    }
    assert(outputType);

    // Above, we parse arguments without inferred type annotation so that
    // they don't produce a runtime error for `null` input, which would
    // preempt the desired null-coalescing behavior.
    // Thus, if any of our arguments would have needed an annotation, we
    // need to wrap the enclosing coalesce expression with it instead.
    const needsAnnotation = expectedType && parsedArgs.some(arg => checkSubtype(expectedType, arg.type));

    return needsAnnotation ? new Coalesce(ValueType, parsedArgs) : new Coalesce(outputType, parsedArgs);
  }

  evaluate(ctx) {
    let result = null;
    for (const arg of this.args) {
      result = arg.evaluate(ctx);
      if (result !== null) break;
    }
    return result;
  }

  eachChild(fn) {
    this.args.forEach(fn);
  }

  possibleOutputs() {
    return [].concat(...this.args.map(arg => arg.possibleOutputs()));
  }

  serialize() {
    const serialized = ['coalesce'];
    this.eachChild(child => {
      serialized.push(child.serialize());
    });
    return serialized;
  }
}

module.exports = Coalesce;
