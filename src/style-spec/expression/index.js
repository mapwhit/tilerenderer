const assert = require('assert');

const ParsingError = require('./parsing_error');
const ParsingContext = require('./parsing_context');
const EvaluationContext = require('./evaluation_context');
const CompoundExpression = require('./compound_expression');
const Step = require('./definitions/step');
const Interpolate = require('./definitions/interpolate');
const Coalesce = require('./definitions/coalesce');
const Let = require('./definitions/let');
const definitions = require('./definitions');
const isConstant = require('./is_constant');
const RuntimeError = require('./runtime_error');
const { success, error } = require('../util/result');
const { supportsPropertyExpression, supportsZoomExpression, supportsInterpolation } = require('../util/properties');

class StyleExpression {
  constructor(expression, propertySpec) {
    this.expression = expression;
    this._warningHistory = {};
    this._evaluator = new EvaluationContext();
    this._defaultValue = getDefaultValue(propertySpec);
    this._enumValues = propertySpec.type === 'enum' ? propertySpec.values : null;
  }

  evaluateWithoutErrorHandling(globals, feature, featureState) {
    this._evaluator.globals = globals;
    this._evaluator.feature = feature;
    this._evaluator.featureState = featureState;

    return this.expression.evaluate(this._evaluator);
  }

  evaluate(globals, feature, featureState) {
    this._evaluator.globals = globals;
    this._evaluator.feature = feature || null;
    this._evaluator.featureState = featureState || null;

    try {
      const val = this.expression.evaluate(this._evaluator);
      if (val === null || val === undefined) {
        return this._defaultValue;
      }
      if (this._enumValues && !this._enumValues.includes(val)) {
        throw new RuntimeError(
          `Expected value to be one of ${this._enumValues
            .map(v => JSON.stringify(v))
            .join(', ')}, but found ${JSON.stringify(val)} instead.`
        );
      }
      return val;
    } catch (e) {
      if (!this._warningHistory[e.message]) {
        this._warningHistory[e.message] = true;
        if (typeof console !== 'undefined') {
          console.warn(e.message);
        }
      }
      return this._defaultValue;
    }
  }
}

function isExpression(expression) {
  return (
    Array.isArray(expression) &&
    expression.length > 0 &&
    typeof expression[0] === 'string' &&
    expression[0] in definitions
  );
}

/**
 * Parse and typecheck the given style spec JSON expression.  If
 * options.defaultValue is provided, then the resulting StyleExpression's
 * `evaluate()` method will handle errors by logging a warning (once per
 * message) and returning the default value.  Otherwise, it will throw
 * evaluation errors.
 *
 * @private
 */
function createExpression(expression, propertySpec) {
  const parser = new ParsingContext(definitions, [], getExpectedType(propertySpec));

  // For string-valued properties, coerce to string at the top level rather than asserting.
  const parsed = parser.parse(
    expression,
    undefined,
    undefined,
    undefined,
    propertySpec.type === 'string' ? { typeAnnotation: 'coerce' } : undefined
  );

  if (!parsed) {
    assert(parser.errors.length > 0);
    return error(parser.errors);
  }

  return success(new StyleExpression(parsed, propertySpec));
}

class ZoomConstantExpression {
  constructor(kind, expression) {
    this.kind = kind;
    this._styleExpression = expression;
    this.isStateDependent = kind !== 'constant' && !isConstant.isStateConstant(expression.expression);
  }

  evaluateWithoutErrorHandling(globals, feature, featureState) {
    return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState);
  }

  evaluate(globals, feature, featureState) {
    return this._styleExpression.evaluate(globals, feature, featureState);
  }
}

class ZoomDependentExpression {
  constructor(kind, expression, zoomCurve) {
    this.kind = kind;
    this.zoomStops = zoomCurve.labels;
    this._styleExpression = expression;
    this.isStateDependent = kind !== 'camera' && !isConstant.isStateConstant(expression.expression);
    if (zoomCurve instanceof Interpolate) {
      this._interpolationType = zoomCurve.interpolation;
    }
  }

  evaluateWithoutErrorHandling(globals, feature, featureState) {
    return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState);
  }

  evaluate(globals, feature, featureState) {
    return this._styleExpression.evaluate(globals, feature, featureState);
  }

  interpolationFactor(input, lower, upper) {
    if (this._interpolationType) {
      return Interpolate.interpolationFactor(this._interpolationType, input, lower, upper);
    }
    return 0;
  }
}

function createPropertyExpression(expression, propertySpec) {
  expression = createExpression(expression, propertySpec);
  if (expression.result === 'error') {
    return expression;
  }

  const parsed = expression.value.expression;

  const isFeatureConstant = isConstant.isFeatureConstant(parsed);
  if (!isFeatureConstant && !supportsPropertyExpression(propertySpec)) {
    return error([new ParsingError('', 'data expressions not supported')]);
  }

  const isZoomConstant = isConstant.isGlobalPropertyConstant(parsed, ['zoom']);
  if (!isZoomConstant && !supportsZoomExpression(propertySpec)) {
    return error([new ParsingError('', 'zoom expressions not supported')]);
  }

  const zoomCurve = findZoomCurve(parsed);
  if (!zoomCurve && !isZoomConstant) {
    return error([
      new ParsingError(
        '',
        '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.'
      )
    ]);
  }
  if (zoomCurve instanceof ParsingError) {
    return error([zoomCurve]);
  }
  if (zoomCurve instanceof Interpolate && !supportsInterpolation(propertySpec)) {
    return error([new ParsingError('', '"interpolate" expressions cannot be used with this property')]);
  }

  if (!zoomCurve) {
    return success(
      isFeatureConstant
        ? new ZoomConstantExpression('constant', expression.value)
        : new ZoomConstantExpression('source', expression.value)
    );
  }

  return success(
    isFeatureConstant
      ? new ZoomDependentExpression('camera', expression.value, zoomCurve)
      : new ZoomDependentExpression('composite', expression.value, zoomCurve)
  );
}

const { isFunction, createFunction } = require('../function');
const { Color } = require('./values');

// serialization wrapper for old-style stop functions normalized to the
// expression interface
class StylePropertyFunction {
  constructor(parameters, specification) {
    this._parameters = parameters;
    this._specification = specification;
    Object.assign(this, createFunction(this._parameters, this._specification));
  }

  static deserialize(serialized) {
    return new StylePropertyFunction(serialized._parameters, serialized._specification);
  }

  static serialize(input) {
    return {
      _parameters: input._parameters,
      _specification: input._specification
    };
  }
}

function normalizePropertyExpression(value, specification) {
  if (isFunction(value)) {
    return new StylePropertyFunction(value, specification);
  }
  if (isExpression(value)) {
    const expression = createPropertyExpression(value, specification);
    if (expression.result === 'error') {
      // this should have been caught in validation
      throw new Error(expression.value.map(err => `${err.key}: ${err.message}`).join(', '));
    }
    return expression.value;
  }
  let constant = value;
  if (typeof value === 'string' && specification.type === 'color') {
    constant = Color.parse(value);
  }
  return {
    kind: 'constant',
    evaluate: () => constant
  };
}

// Zoom-dependent expressions may only use ["zoom"] as the input to a top-level "step" or "interpolate"
// expression (collectively referred to as a "curve"). The curve may be wrapped in one or more "let" or
// "coalesce" expressions.
function findZoomCurve(expression) {
  let result = null;
  if (expression instanceof Let) {
    result = findZoomCurve(expression.result);
  } else if (expression instanceof Coalesce) {
    for (const arg of expression.args) {
      result = findZoomCurve(arg);
      if (result) {
        break;
      }
    }
  } else if (
    (expression instanceof Step || expression instanceof Interpolate) &&
    expression.input instanceof CompoundExpression &&
    expression.input.name === 'zoom'
  ) {
    result = expression;
  }

  if (result instanceof ParsingError) {
    return result;
  }

  expression.eachChild(child => {
    const childResult = findZoomCurve(child);
    if (childResult instanceof ParsingError) {
      result = childResult;
    } else if (!result && childResult) {
      result = new ParsingError(
        '',
        '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.'
      );
    } else if (result && childResult && result !== childResult) {
      result = new ParsingError(
        '',
        'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.'
      );
    }
  });

  return result;
}

const { ColorType, StringType, NumberType, BooleanType, ValueType, FormattedType, array } = require('./types');

function getExpectedType(spec) {
  const types = {
    color: ColorType,
    string: StringType,
    number: NumberType,
    enum: StringType,
    boolean: BooleanType,
    formatted: FormattedType
  };

  if (spec.type === 'array') {
    return array(types[spec.value] || ValueType, spec.length);
  }

  return types[spec.type];
}

function getDefaultValue(spec) {
  if (spec.type === 'color' && isFunction(spec.default)) {
    // Special case for heatmap-color: it uses the 'default:' to define a
    // default color ramp, but createExpression expects a simple value to fall
    // back to in case of runtime errors
    return new Color(0, 0, 0, 0);
  }
  if (spec.type === 'color') {
    return Color.parse(spec.default) || null;
  }
  if (spec.default === undefined) {
    return null;
  }
  return spec.default;
}

module.exports = {
  StyleExpression,
  isExpression,
  createExpression,
  ZoomConstantExpression,
  ZoomDependentExpression,
  createPropertyExpression,
  StylePropertyFunction,
  normalizePropertyExpression
};
