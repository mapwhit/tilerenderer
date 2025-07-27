const test = require('node:test');

module.exports = {
  test
};

test.beforeEach(t => {
  t.assert.notOk = assertNotOk;
  t.assert.equalWithPrecision = assertEqualWithPrecision;
});

function assertNotOk(cond, ...args) {
  this.ok(!cond, ...args);
}

function assertEqualWithPrecision(expected, actual, multiplier, message = `should be equal to within ${multiplier}`) {
  const expectedRounded = Math.round(expected / multiplier) * multiplier;
  const actualRounded = Math.round(actual / multiplier) * multiplier;

  return this.equal(expectedRounded, actualRounded, message);
}
