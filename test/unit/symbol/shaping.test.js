import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Formatted } from '@mapwhit/style-expressions';
import * as shaping from '../../../src/symbol/shaping.js';
import expectedLinebreak from '../../expected/text-shaping-linebreak.json' with { type: 'json' };

const WritingMode = shaping.WritingMode;

let UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
  UPDATE = !!process.env.UPDATE;
}

test('shaping', t => {
  const oneEm = 24;
  const fontStack = 'Test';
  const glyphs = {
    Test: JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '/../../fixtures/fontstack-glyphs.json')))
  };

  let shaped;

  JSON.parse('{}');

  shaped = shaping.shapeText(
    Formatted.fromString(`hi${String.fromCharCode(0)}`),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  if (UPDATE)
    fs.writeFileSync(
      path.join(import.meta.dirname, '/../../expected/text-shaping-null.json'),
      JSON.stringify(shaped, null, 2)
    );
  t.assert.deepEqual(
    shaped,
    JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '/../../expected/text-shaping-null.json')))
  );

  // Default shaping.
  shaped = shaping.shapeText(
    Formatted.fromString('abcde'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  if (UPDATE)
    fs.writeFileSync(
      path.join(import.meta.dirname, '/../../expected/text-shaping-default.json'),
      JSON.stringify(shaped, null, 2)
    );
  t.assert.deepEqual(
    shaped,
    JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '/../../expected/text-shaping-default.json')))
  );

  // Letter spacing.
  shaped = shaping.shapeText(
    Formatted.fromString('abcde'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0.125 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  if (UPDATE)
    fs.writeFileSync(
      path.join(import.meta.dirname, '/../../expected/text-shaping-spacing.json'),
      JSON.stringify(shaped, null, 2)
    );
  t.assert.deepEqual(
    shaped,
    JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '/../../expected/text-shaping-spacing.json')))
  );

  // Line break.
  shaped = shaping.shapeText(
    Formatted.fromString('abcde abcde'),
    glyphs,
    fontStack,
    4 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  if (UPDATE)
    fs.writeFileSync(
      path.join(import.meta.dirname, '/../../expected/text-shaping-linebreak.json'),
      JSON.stringify(shaped, null, 2)
    );
  t.assert.deepEqual(shaped, expectedLinebreak);

  const expectedNewLine = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, '/../../expected/text-shaping-newline.json'))
  );

  shaped = shaping.shapeText(
    Formatted.fromString('abcde\nabcde'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  if (UPDATE)
    fs.writeFileSync(
      path.join(import.meta.dirname, '/../../expected/text-shaping-newline.json'),
      JSON.stringify(shaped, null, 2)
    );
  t.assert.deepEqual(shaped, expectedNewLine);

  shaped = shaping.shapeText(
    Formatted.fromString('abcde\r\nabcde'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  t.assert.deepEqual(shaped.positionedGlyphs, expectedNewLine.positionedGlyphs);

  const expectedNewLinesInMiddle = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, '/../../expected/text-shaping-newlines-in-middle.json'))
  );

  shaped = shaping.shapeText(
    Formatted.fromString('abcde\n\nabcde'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  if (UPDATE)
    fs.writeFileSync(
      path.join(import.meta.dirname, '/../../expected/text-shaping-newlines-in-middle.json'),
      JSON.stringify(shaped, null, 2)
    );
  t.assert.deepEqual(shaped, expectedNewLinesInMiddle);

  // Null shaping.
  shaped = shaping.shapeText(
    Formatted.fromString(''),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  t.assert.equal(false, shaped);

  shaped = shaping.shapeText(
    Formatted.fromString(String.fromCharCode(0)),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  t.assert.equal(false, shaped);

  // https://github.com/mapbox/mapbox-gl-js/issues/3254
  shaped = shaping.shapeText(
    Formatted.fromString('   foo bar\n'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  const shaped2 = shaping.shapeText(
    Formatted.fromString('foo bar'),
    glyphs,
    fontStack,
    15 * oneEm,
    oneEm,
    'center',
    'center',
    0 * oneEm,
    [0, 0],
    oneEm,
    WritingMode.horizontal
  );
  t.assert.deepEqual(shaped.positionedGlyphs, shaped2.positionedGlyphs);
});
