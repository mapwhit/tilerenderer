const assert = require('assert');

const { ColorType, ValueType, NumberType } = require('../types');
const { Color, validateRGBA } = require('../values');
const RuntimeError = require('../runtime_error');
const { Formatted, FormattedSection } = require('./formatted');

const types = {
  'to-number': NumberType,
  'to-color': ColorType
};

/**
 * Special form for error-coalescing coercion expressions "to-number",
 * "to-color".  Since these coercions can fail at runtime, they accept multiple
 * arguments, only evaluating one at a time until one succeeds.
 *
 * @private
 */
class Coercion {
  constructor(type, args) {
    this.type = type;
    this.args = args;
  }

  static parse(args, context) {
    if (args.length < 2) return context.error('Expected at least one argument.');

    const name = args[0];
    assert(types[name], name);

    const type = types[name];

    const parsed = [];
    for (let i = 1; i < args.length; i++) {
      const input = context.parse(args[i], i, ValueType);
      if (!input) return null;
      parsed.push(input);
    }

    return new Coercion(type, parsed);
  }

  evaluate(ctx) {
    if (this.type.kind === 'color') {
      let input;
      let error;
      for (const arg of this.args) {
        input = arg.evaluate(ctx);
        error = null;
        if (input instanceof Color) {
          return input;
        }
        if (typeof input === 'string') {
          const c = ctx.parseColor(input);
          if (c) return c;
        } else if (Array.isArray(input)) {
          if (input.length < 3 || input.length > 4) {
            error = `Invalid rbga value ${JSON.stringify(input)}: expected an array containing either three or four numeric values.`;
          } else {
            error = validateRGBA(input[0], input[1], input[2], input[3]);
          }
          if (!error) {
            return new Color(input[0] / 255, input[1] / 255, input[2] / 255, input[3]);
          }
        }
      }
      throw new RuntimeError(
        error || `Could not parse color from value '${typeof input === 'string' ? input : JSON.stringify(input)}'`
      );
    }
    if (this.type.kind === 'formatted') {
      let input;
      for (const arg of this.args) {
        input = arg.evaluate(ctx);
        if (typeof input === 'string') {
          return new Formatted([new FormattedSection(input, null, null)]);
        }
      }
      throw new RuntimeError(
        `Could not parse formatted text from value '${typeof input === 'string' ? input : JSON.stringify(input)}'`
      );
    }
    let value = null;
    for (const arg of this.args) {
      value = arg.evaluate(ctx);
      if (value === null) continue;
      const num = Number(value);
      if (isNaN(num)) continue;
      return num;
    }
    throw new RuntimeError(`Could not convert ${JSON.stringify(value)} to number.`);
  }

  eachChild(fn) {
    this.args.forEach(fn);
  }

  possibleOutputs() {
    return [].concat(...this.args.map(arg => arg.possibleOutputs()));
  }

  serialize() {
    const serialized = [`to-${this.type.kind}`];
    this.eachChild(child => {
      serialized.push(child.serialize());
    });
    return serialized;
  }
}

module.exports = Coercion;
