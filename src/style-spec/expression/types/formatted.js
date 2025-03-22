class FormattedSection {
  constructor(text, scale, fontStack = null) {
    this.text = text;
    this.scale = scale;
    this.fontStack = fontStack;
  }
}

class Formatted {
  constructor(sections) {
    this.sections = sections;
  }

  static fromString(unformatted) {
    return new Formatted([new FormattedSection(unformatted, null, null)]);
  }

  toString() {
    return this.sections.map(section => section.text).join('');
  }

  serialize() {
    const serialized = ['format'];
    for (const section of this.sections) {
      serialized.push(section.text);
      const options = {};
      if (section.fontStack) {
        options['text-font'] = ['literal', section.fontStack.split(',')];
      }
      if (section.scale) {
        options['font-scale'] = section.scale;
      }
      serialized.push(options);
    }
    return serialized;
  }
}

module.exports = { Formatted, FormattedSection };
