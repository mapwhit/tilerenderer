const { createExpression } = require('../expression');

module.exports = createFilter;

createFilter.isExpressionFilter = isExpressionFilter;

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
      for (const f of filter.slice(1)) {
        if (!isExpressionFilter(f) && typeof f !== 'boolean') {
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
    return () => true;
  }

  if (!isExpressionFilter(filter)) {
    filter = convertFilter(filter);
  }

  const compiled = createExpression(filter, filterSpec);
  if (compiled.result === 'error') {
    throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
  }
  return (globalProperties, feature) => compiled.value.evaluate(globalProperties, feature);
}

// Comparison function to sort numbers and strings
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function convertFilter(filter) {
  if (!filter) return true;
  const op = filter[0];
  if (filter.length <= 1) return op !== 'any';
  const converted =
    op === '=='
      ? convertComparisonOp(filter[1], filter[2], '==')
      : op === '!='
        ? convertNegation(convertComparisonOp(filter[1], filter[2], '=='))
        : op === '<' || op === '>' || op === '<=' || op === '>='
          ? convertComparisonOp(filter[1], filter[2], op)
          : op === 'any'
            ? convertDisjunctionOp(filter.slice(1))
            : op === 'all'
              ? ['all'].concat(filter.slice(1).map(convertFilter))
              : op === 'none'
                ? ['all'].concat(filter.slice(1).map(convertFilter).map(convertNegation))
                : op === 'in'
                  ? convertInOp(filter[1], filter.slice(2))
                  : op === '!in'
                    ? convertNegation(convertInOp(filter[1], filter.slice(2)))
                    : op === 'has'
                      ? convertHasOp(filter[1])
                      : op === '!has'
                        ? convertNegation(convertHasOp(filter[1]))
                        : true;
  return converted;
}

function convertComparisonOp(property, value, op) {
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
  return ['any'].concat(filters.map(convertFilter));
}

function convertInOp(property, values) {
  if (values.length === 0) {
    return false;
  }
  switch (property) {
    case '$type':
      return ['filter-type-in', ['literal', values]];
    case '$id':
      return ['filter-id-in', ['literal', values]];
    default:
      if (values.length > 200 && !values.some(v => typeof v !== typeof values[0])) {
        return ['filter-in-large', property, ['literal', values.sort(compare)]];
      }
      return ['filter-in-small', property, ['literal', values]];
  }
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
