const Scope = require('./scope');

const { checkSubtype } = require('./types');
const ParsingError = require('./parsing_error');
const Literal = require('./definitions/literal');
const Assertion = require('./definitions/assertion');
const ArrayAssertion = require('./definitions/array');
const Coercion = require('./definitions/coercion');
const EvaluationContext = require('./evaluation_context');
const { CollatorExpression } = require('./definitions/collator');
const { isGlobalPropertyConstant, isFeatureConstant } = require('./is_constant');
const Var = require('./definitions/var');

/**
 * State associated parsing at a given point in an expression tree.
 * @private
 */
class ParsingContext {
  // The expected type of this expression. Provided only to allow Expression
  // implementations to infer argument types: Expression#parse() need not
  // check that the output type of the parsed expression matches
  // `expectedType`.

  constructor(registry, path = [], expectedType, scope = new Scope(), errors = []) {
    this.registry = registry;
    this.path = path;
    this.key = path.map(part => `[${part}]`).join('');
    this.scope = scope;
    this.errors = errors;
    this.expectedType = expectedType;
  }

  /**
   * @param expr the JSON expression to parse
   * @param index the optional argument index if this expression is an argument of a parent expression that's being parsed
   * @param options
   * @param options.omitTypeAnnotations set true to omit inferred type annotations.  Caller beware: with this option set, the parsed expression's type will NOT satisfy `expectedType` if it would normally be wrapped in an inferred annotation.
   * @private
   */
  parse(expr, index, expectedType, bindings, options = {}) {
    if (index) {
      return this.concat(index, expectedType, bindings)._parse(expr, options);
    }
    return this._parse(expr, options);
  }

  _parse(expr, options) {
    if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
      expr = ['literal', expr];
    }

    if (Array.isArray(expr)) {
      if (expr.length === 0) {
        return this.error(
          `Expected an array with at least one element. If you wanted a literal array, use ["literal", []].`
        );
      }

      const op = expr[0];
      if (typeof op !== 'string') {
        this.error(
          `Expression name must be a string, but found ${typeof op} instead. If you wanted a literal array, use ["literal", [...]].`,
          0
        );
        return null;
      }

      const Expr = this.registry[op];
      if (Expr) {
        let parsed = Expr.parse(expr, this);
        if (!parsed) return null;

        if (this.expectedType) {
          const expected = this.expectedType;
          const actual = parsed.type;

          // When we expect a number, string, boolean, or array but
          // have a Value, we can wrap it in a refining assertion.
          // When we expect a Color but have a String or Value, we
          // can wrap it in "to-color" coercion.
          // Otherwise, we do static type-checking.
          if (
            (expected.kind === 'string' ||
              expected.kind === 'number' ||
              expected.kind === 'boolean' ||
              expected.kind === 'object') &&
            actual.kind === 'value'
          ) {
            if (!options.omitTypeAnnotations) {
              parsed = new Assertion(expected, [parsed]);
            }
          } else if (expected.kind === 'array' && actual.kind === 'value') {
            if (!options.omitTypeAnnotations) {
              parsed = new ArrayAssertion(expected, [parsed]);
            }
          } else if (expected.kind === 'color' && (actual.kind === 'value' || actual.kind === 'string')) {
            if (!options.omitTypeAnnotations) {
              parsed = new Coercion(expected, [parsed]);
            }
          } else if (expected.kind === 'formatted' && (actual.kind === 'value' || actual.kind === 'string')) {
            if (!options.omitTypeAnnotations) {
              parsed = new Coercion(expected, [parsed]);
            }
          } else if (this.checkSubtype(this.expectedType, parsed.type)) {
            return null;
          }
        }

        // If an expression's arguments are all literals, we can evaluate
        // it immediately and replace it with a literal value in the
        // parsed/compiled result.
        if (!(parsed instanceof Literal) && isConstant(parsed)) {
          const ec = new EvaluationContext();
          try {
            parsed = new Literal(parsed.type, parsed.evaluate(ec));
          } catch (e) {
            this.error(e.message);
            return null;
          }
        }

        return parsed;
      }

      return this.error(`Unknown expression "${op}". If you wanted a literal array, use ["literal", [...]].`, 0);
    }
    if (typeof expr === 'undefined') {
      return this.error(`'undefined' value invalid. Use null instead.`);
    }
    if (typeof expr === 'object') {
      return this.error(`Bare objects invalid. Use ["literal", {...}] instead.`);
    }
    return this.error(`Expected an array, but found ${typeof expr} instead.`);
  }

  /**
   * Returns a copy of this context suitable for parsing the subexpression at
   * index `index`, optionally appending to 'let' binding map.
   *
   * Note that `errors` property, intended for collecting errors while
   * parsing, is copied by reference rather than cloned.
   * @private
   */
  concat(index, expectedType, bindings) {
    const path = typeof index === 'number' ? this.path.concat(index) : this.path;
    const scope = bindings ? this.scope.concat(bindings) : this.scope;
    return new ParsingContext(this.registry, path, expectedType || null, scope, this.errors);
  }

  /**
   * Push a parsing (or type checking) error into the `this.errors`
   * @param error The message
   * @param keys Optionally specify the source of the error at a child
   * of the current expression at `this.key`.
   * @private
   */
  error(error, ...keys) {
    const key = `${this.key}${keys.map(k => `[${k}]`).join('')}`;
    this.errors.push(new ParsingError(key, error));
  }

  /**
   * Returns null if `t` is a subtype of `expected`; otherwise returns an
   * error message and also pushes it to `this.errors`.
   */
  checkSubtype(expected, t) {
    const error = checkSubtype(expected, t);
    if (error) this.error(error);
    return error;
  }
}

module.exports = ParsingContext;

function isConstant(expression) {
  const CompoundExpression = require('./compound_expression');

  if (expression instanceof Var) {
    return isConstant(expression.boundExpression);
  }
  if (expression instanceof CompoundExpression && expression.name === 'error') {
    return false;
  }
  if (expression instanceof CollatorExpression) {
    // Although the results of a Collator expression with fixed arguments
    // generally shouldn't change between executions, we can't serialize them
    // as constant expressions because results change based on environment.
    return false;
  }

  const isTypeAnnotation =
    expression instanceof Coercion || expression instanceof Assertion || expression instanceof ArrayAssertion;

  let childrenConstant = true;
  expression.eachChild(child => {
    // We can _almost_ assume that if `expressions` children are constant,
    // they would already have been evaluated to Literal values when they
    // were parsed.  Type annotations are the exception, because they might
    // have been inferred and added after a child was parsed.

    // So we recurse into isConstant() for the children of type annotations,
    // but otherwise simply check whether they are Literals.
    if (isTypeAnnotation) {
      childrenConstant = childrenConstant && isConstant(child);
    } else {
      childrenConstant = childrenConstant && child instanceof Literal;
    }
  });
  if (!childrenConstant) {
    return false;
  }

  return (
    isFeatureConstant(expression) &&
    isGlobalPropertyConstant(expression, ['zoom', 'heatmap-density', 'line-progress', 'is-supported-script'])
  );
}
