const test = require('node:test');

module.exports = {
  test
};

test.beforeEach(t => {
  t.assert.notOk = assertNotOk;
});

function assertNotOk(cond, ...args) {
  this.ok(!cond, ...args);
}
