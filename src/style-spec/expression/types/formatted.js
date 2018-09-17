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
      const fontStack = section.fontStack ? ['literal', section.fontStack.split(',')] : null;
      serialized.push({ 'text-font': fontStack, 'font-scale': section.scale });
    }
    return serialized;
  }
}

module.exports = { Formatted, FormattedSection };
