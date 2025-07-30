const { createExpression, findGlobalStateRefs } = require('@mapwhit/style-expressions');

module.exports = createFilter;

createFilter.isExpressionFilter = isExpressionFilter;
createFilter.addGlobalStateRefs = addGlobalStateRefs;

function isExpressionFilter(filter) {
  if (filter === true || filter === false) {
    return true;
  }
  if (!Array.isArray(filter) || filter.length === 0) {
    return false;
  }
  switch (filter[0]) {
    case 'has':
      return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';

    case 'in':
    case '!in':
    case '!has':
    case 'none':
      return false;

    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
      return filter.length !== 3 || Array.isArray(filter[1]) || Array.isArray(filter[2]);

    case 'any':
    case 'all':
      for (let i = 1; i < filter.length; i++) {
        const f = filter[i];
        if (typeof f !== 'boolean' && !isExpressionFilter(f)) {
          return false;
        }
      }
      return true;

    default:
      return true;
  }
}

const filterSpec = {
  type: 'boolean',
  default: false,
  transition: false,
  'property-type': 'data-driven',
  expression: {
    interpolated: false,
    parameters: ['zoom', 'feature']
  }
};

/**
 * Given a filter expressed as nested arrays, return a new function
 * that evaluates whether a given feature (with a .properties or .tags property)
 * passes its test.
 *
 * @private
 * @param {Array} filter mapbox gl filter
 * @returns {Function} filter-evaluating function
 */
function createFilter(filter) {
  if (filter === null || filter === undefined) {
    return addGlobalStateRefs(() => true);
  }

  if (!isExpressionFilter(filter)) {
    filter = convertFilter(filter);
  }

  const compiled = createExpression(filter, filterSpec);
  if (compiled.result === 'error') {
    throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
  }
  return addGlobalStateRefs(
    (globalProperties, feature) => compiled.value.evaluate(globalProperties, feature),
    () => findGlobalStateRefs(compiled.value.expression)
  );
}

function addGlobalStateRefs(filter, getGlobalStateRefs = () => new Set()) {
  filter.getGlobalStateRefs = getGlobalStateRefs;
  return filter;
}

// Comparison function to sort numbers and strings
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function convertFilter(filter) {
  if (!filter || filter.length === 0) return true;
  const [op, ...args] = filter;
  if (filter.length <= 1) return op !== 'any';
  switch (op) {
    case '!=':
      return convertNegation(convertComparisonOp('==', ...args));
    case '==':
    case '<':
    case '>':
    case '<=':
    case '>=':
      return convertComparisonOp(op, ...args);
    case 'any':
      return convertDisjunctionOp(args);
    case 'all':
      return ['all', ...args.map(convertFilter)];
    case 'none':
      return ['all', ...args.map(convertFilter).map(convertNegation)];
    case 'in':
      return convertInOp(args);
    case '!in':
      return convertNegation(convertInOp(args));
    case 'has':
      return convertHasOp(args[0]);
    case '!has':
      return convertNegation(convertHasOp(args[0]));
    default:
      return true;
  }
}

function convertComparisonOp(op, property, value) {
  switch (property) {
    case '$type':
      return [`filter-type-${op}`, value];
    case '$id':
      return [`filter-id-${op}`, value];
    default:
      return [`filter-${op}`, property, value];
  }
}

function convertDisjunctionOp(filters) {
  return ['any', ...filters.map(convertFilter)];
}

function convertInOp([property, ...values]) {
  if (values.length === 0) {
    return false;
  }
  switch (property) {
    case '$type':
      return ['filter-type-in', ['literal', values]];
    case '$id':
      return ['filter-id-in', ['literal', values]];
    default:
      return isUniformLarge(values)
        ? ['filter-in-large', property, ['literal', values.sort(compare)]]
        : ['filter-in-small', property, ['literal', values]];
  }
}

function isUniformLarge(values) {
  if (values.length < 200) return false;
  const type = typeof values[0];
  return values.every(v => typeof v === type);
}

function convertHasOp(property) {
  switch (property) {
    case '$type':
      return true;
    case '$id':
      return ['filter-has-id'];
    default:
      return ['filter-has', property];
  }
}

function convertNegation(filter) {
  return ['!', filter];
}
