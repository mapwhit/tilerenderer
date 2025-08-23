import test from 'node:test';
import { packUint8ToFloat } from '../../../src/shaders/encode_attribute.js';

test('packUint8ToFloat', t => {
  t.assert.equal(packUint8ToFloat(0, 0), 0);
  t.assert.equal(packUint8ToFloat(255, 255), 65535);
  t.assert.equal(packUint8ToFloat(123, 45), 31533);

  t.assert.equal(packUint8ToFloat(-1, -1), 0);
  t.assert.equal(packUint8ToFloat(256, 256), 65535);
});
