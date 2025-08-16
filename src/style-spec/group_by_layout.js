const refProperties = require('./util/ref_properties');

function stringify(obj) {
  if (obj == null) return 'null';
  const type = typeof obj;
  if (type === 'number' || type === 'boolean' || type === 'string') return obj;

  if (Array.isArray(obj)) {
    return '[' + obj.map(val => stringify(val)).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  return '{' + keys.map(key => `${key}:${stringify(obj[key])}`).join(',') + '}';
}

// TODO: this is a temporary hack
const mapProperty = {
  layout: 'layoutObj'
};

function getKey(layer) {
  return refProperties.map(k => stringify(layer[mapProperty[k] ?? k])).join('/');
}

module.exports = groupByLayout;

/**
 * Given an array of layers, return an array of arrays of layers where all
 * layers in each group have identical layout-affecting properties. These
 * are the properties that were formerly used by explicit `ref` mechanism
 * for layers: 'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
 * 'filter', and 'layout'.
 *
 * The input is not modified. The output layers are references to the
 * input layers.
 *
 * @private
 * @param {Array<Layer>} layers
 * @returns {Array<Array<Layer>>}
 */
function groupByLayout(layers) {
  const groups = {};

  for (const l of layers) {
    const k = getKey(l);
    const group = (groups[k] ??= []);
    group.push(l);
  }

  return Object.values(groups);
}
