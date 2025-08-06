const { createExpression, findGlobalStateRefs } = require('@mapwhit/style-expressions');

module.exports = createVisibility;

const visibilitySpec = {
  type: 'enum',
  values: ['visible', 'none'],
  default: 'visible',
  expression: {
    parameters: ['global-state']
  }
};

function createVisibility(visibility) {
  if (visibility === null || visibility === undefined || visibility === 'visible' || visibility === 'none') {
    return;
  }

  const compiled = createExpression(visibility, visibilitySpec);
  if (compiled.result === 'error') {
    throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));
  }
  return addGlobalStateRefs(
    globalProperties => compiled.value.evaluate(globalProperties),
    () => findGlobalStateRefs(compiled.value.expression)
  );
}

function addGlobalStateRefs(visibility, getGlobalStateRefs = () => new Set()) {
  visibility.getGlobalStateRefs = getGlobalStateRefs;
  return visibility;
}
