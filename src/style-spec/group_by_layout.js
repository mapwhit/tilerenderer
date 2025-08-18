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
    const group = (groups[l.key] ??= []);
    group.push(l);
  }

  return Object.values(groups);
}
