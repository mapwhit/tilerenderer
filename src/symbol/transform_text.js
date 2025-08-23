import { plugin as rtlTextPlugin } from '../source/rtl_text_plugin.js';

function transformText(text, layer, feature) {
  const transform = layer._layout.get('text-transform').evaluate(feature, {});
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

export default function (text, layer, feature) {
  text.sections.forEach(section => {
    section.text = transformText(section.text, layer, feature);
  });
  return text;
}
