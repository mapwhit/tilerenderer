import { createExpression, findGlobalStateRefs } from '@mapwhit/style-expressions';

const visibilitySpec = {
  type: 'enum',
  values: ['visible', 'none'],
  default: 'visible',
  expression: {
    parameters: ['global-state']
  }
};

export default function createVisibility(visibility, globalState) {
  const expression = {
    setValue
  };
  setValue(visibility);
  return expression;

  function setValue(visibility) {
    if (visibility === null || visibility === undefined || visibility === 'visible' || visibility === 'none') {
      expression.evaluate = visibility === 'none' ? () => 'none' : () => 'visible';
      addGlobalStateRefs(expression);
      return;
    }

    const compiled = createExpression(visibility, visibilitySpec, globalState);
    if (compiled.result === 'error') {
      throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
    }
    expression.evaluate = () => compiled.value.evaluate({});
    addGlobalStateRefs(expression, () => findGlobalStateRefs(compiled.value.expression));
  }
}

function addGlobalStateRefs(visibility, getGlobalStateRefs = () => new Set()) {
  visibility.getGlobalStateRefs = getGlobalStateRefs;
}
