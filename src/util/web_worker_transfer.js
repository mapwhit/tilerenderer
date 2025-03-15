const Grid = require('grid-index');
const Color = require('../style-spec/util/color');
const {
  StylePropertyFunction,
  StyleExpression,
  ZoomDependentExpression,
  ZoomConstantExpression
} = require('../style-spec/expression');
const CompoundExpression = require('../style-spec/expression/compound_expression');
const expressions = require('../style-spec/expression/definitions');

const { register, serialize, deserialize } = require('./transfer_registry');
module.exports = {
  serialize,
  deserialize
};

Grid.serialize = function serializeGrid(grid, transferables) {
  const buffer = grid.toArrayBuffer();
  if (transferables) {
    transferables.push(buffer);
  }
  return { buffer };
};

Grid.deserialize = function deserializeGrid(serialized) {
  return new Grid(serialized.buffer);
};
register('Grid', Grid);

register('Color', Color);
register('Error', Error);

register('StylePropertyFunction', StylePropertyFunction);
register('StyleExpression', StyleExpression, { omit: ['_evaluator'] });

register('ZoomDependentExpression', ZoomDependentExpression);
register('ZoomConstantExpression', ZoomConstantExpression);
register('CompoundExpression', CompoundExpression, { omit: ['_evaluate'] });
for (const name in expressions) {
  if (expressions[name]._classRegistryKey) continue;
  register(`Expression_${name}`, expressions[name]);
}
