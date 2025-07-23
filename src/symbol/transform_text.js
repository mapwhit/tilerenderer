const { plugin: rtlTextPlugin } = require('../source/rtl_text_plugin');

function transformText(text, layer, feature) {
  const transform = layer.layout.get('text-transform').evaluate(feature, {});
  if (transform === 'uppercase') {
    text = text.toLocaleUpperCase();
  } else if (transform === 'lowercase') {
    text = text.toLocaleLowerCase();
  }

  if (rtlTextPlugin.applyArabicShaping) {
    text = rtlTextPlugin.applyArabicShaping(text);
  }

  return text;
}

module.exports = function (text, layer, feature) {
  text.sections.forEach(section => {
    section.text = transformText(section.text, layer, feature);
  });
  return text;
};
