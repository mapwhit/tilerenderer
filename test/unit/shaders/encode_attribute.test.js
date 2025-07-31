const test = require('node:test');
const { packUint8ToFloat } = require('../../../src/shaders/encode_attribute');

test('packUint8ToFloat', t => {
  t.assert.equal(packUint8ToFloat(0, 0), 0);
  t.assert.equal(packUint8ToFloat(255, 255), 65535);
  t.assert.equal(packUint8ToFloat(123, 45), 31533);

  t.assert.equal(packUint8ToFloat(-1, -1), 0);
  t.assert.equal(packUint8ToFloat(256, 256), 65535);
});
