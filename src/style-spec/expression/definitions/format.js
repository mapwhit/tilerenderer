const { NumberType, ValueType, FormattedType, array, StringType } = require('../types');
const { Formatted, FormattedSection } = require('../types/formatted');
const { toString } = require('../values');

class FormatExpression {
  constructor(sections) {
    this.type = FormattedType;
    this.sections = sections;
  }

  static parse(args, context) {
    if (args.length < 3) {
      return context.error('Expected at least two arguments.');
    }

    if ((args.length - 1) % 2 !== 0) {
      return context.error('Expected an even number of arguments.');
    }

    const sections = [];
    for (let i = 1; i < args.length - 1; i += 2) {
      const text = context.parse(args[i], 1, ValueType);
      if (!text) return null;
      const kind = text.type.kind;
      if (kind !== 'string' && kind !== 'value' && kind !== 'null')
        return context.error("Formatted text type must be 'string', 'value', or 'null'.");

      const options = args[i + 1];
      if (typeof options !== 'object' || Array.isArray(options))
        return context.error('Format options argument must be an object.');

      let scale = null;
      if (options['font-scale']) {
        scale = context.parse(options['font-scale'], 1, NumberType);
        if (!scale) return null;
      }

      let font = null;
      if (options['text-font']) {
        font = context.parse(options['text-font'], 1, array(StringType));
        if (!font) return null;
      }
      sections.push({ text, scale, font });
    }

    return new FormatExpression(sections);
  }

  evaluate(ctx) {
    return new Formatted(
      this.sections.map(
        section =>
          new FormattedSection(
            toString(section.text.evaluate(ctx)),
            section.scale ? section.scale.evaluate(ctx) : null,
            section.font ? section.font.evaluate(ctx).join(',') : null
          )
      )
    );
  }

  eachChild(fn) {
    for (const section of this.sections) {
      fn(section.text);
      if (section.scale) {
        fn(section.scale);
      }
      if (section.font) {
        fn(section.font);
      }
    }
  }

  possibleOutputs() {
    // Technically the combinatoric set of all children
    // Usually, this.text will be undefined anyway
    return [undefined];
  }

  serialize() {
    const serialized = ['format'];
    for (const section of this.sections) {
      serialized.push(section.text.serialize());
      const options = {};
      if (section.scale) {
        options['font-scale'] = section.scale.serialize();
      }
      if (section.font) {
        options['text-font'] = section.font.serialize();
      }
      serialized.push(options);
    }
    return serialized;
  }
}

module.exports = { Formatted, FormatExpression };
