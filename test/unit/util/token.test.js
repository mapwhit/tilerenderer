const test = require('node:test');
const resolveTokens = require('../../../src/util/token');

test('resolveToken', t => {
  t.assert.equal('3 Fine Fields', resolveTokens({ a: 3, b: 'Fine', c: 'Fields' }, '{a} {b} {c}'));

  // No tokens.
  t.assert.equal(resolveTokens({}, 'Test'), 'Test');

  // Basic.
  t.assert.equal(resolveTokens({ name: 'Test' }, '{name}'), 'Test');
  t.assert.equal(resolveTokens({ name: 'Test' }, '{name}-suffix'), 'Test-suffix');

  // Undefined property.
  t.assert.equal(resolveTokens({}, '{name}'), '');
  t.assert.equal(resolveTokens({}, '{name}-suffix'), '-suffix');

  // Non-latin.
  t.assert.equal(resolveTokens({ city: '서울특별시' }, '{city}'), '서울특별시');

  // Unicode up to 65535.
  t.assert.equal(resolveTokens({ text: '\ufff0' }, '{text}'), '\ufff0');
  t.assert.equal(resolveTokens({ text: '\uffff' }, '{text}'), '\uffff');

  // Non-string values cast to strings.
  t.assert.equal(resolveTokens({ name: 5000 }, '{name}'), '5000');
  t.assert.equal(resolveTokens({ name: -15.5 }, '{name}'), '-15.5');
  t.assert.equal(resolveTokens({ name: true }, '{name}'), 'true');

  // Non-string values cast to strings, with token replacement.
  t.assert.equal(resolveTokens({ name: 5000 }, '{name}-suffix'), '5000-suffix');
  t.assert.equal(resolveTokens({ name: -15.5 }, '{name}-suffix'), '-15.5-suffix');
  t.assert.equal(resolveTokens({ name: true }, '{name}-suffix'), 'true-suffix');

  // Special characters in token.
  t.assert.equal(resolveTokens({ 'dashed-property': 'dashed' }, '{dashed-property}'), 'dashed');
  t.assert.equal(resolveTokens({ HØYDE: 150 }, '{HØYDE} m'), '150 m');
  t.assert.equal(resolveTokens({ '$special:characters;': 'mapbox' }, '{$special:characters;}'), 'mapbox');
});
