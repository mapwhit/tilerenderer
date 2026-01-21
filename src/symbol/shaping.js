import { plugin as rtlTextPlugin } from '../source/rtl_text_plugin.js';
import { charAllowsIdeographicBreaking, charHasUprightVerticalOrientation } from '../util/script_detection.js';
import verticalizePunctuation from '../util/verticalize_punctuation.js';
import ONE_EM from './one_em.js';

export const WritingMode = {
  horizontal: 1,
  vertical: 2,
  horizontalOnly: 3
};

class TaggedString {
  constructor() {
    this.text = '';
    this.sectionIndex = []; // maps each character in 'text' to its corresponding entry in 'sections'
    this.sections = [];
  }

  static fromFeature(text, defaultFontStack) {
    const result = new TaggedString();
    for (let i = 0; i < text.sections.length; i++) {
      const section = text.sections[i];
      result.sections.push({
        scale: section.scale || 1,
        fontStack: section.fontStack || defaultFontStack
      });
      result.text += section.text;
      for (let j = 0; j < section.text.length; j++) {
        result.sectionIndex.push(i);
      }
    }
    return result;
  }

  length() {
    return this.text.length;
  }

  getSection(index) {
    return this.sections[this.sectionIndex[index]];
  }

  getCharCode(index) {
    return this.text.charCodeAt(index);
  }

  verticalizePunctuation() {
    this.text = verticalizePunctuation(this.text);
  }

  trim() {
    let beginningWhitespace = 0;
    for (let i = 0; i < this.text.length && whitespace[this.text.charCodeAt(i)]; i++) {
      beginningWhitespace++;
    }
    let trailingWhitespace = this.text.length;
    for (let i = this.text.length - 1; i >= 0 && i >= beginningWhitespace && whitespace[this.text.charCodeAt(i)]; i--) {
      trailingWhitespace--;
    }
    this.text = this.text.substring(beginningWhitespace, trailingWhitespace);
    this.sectionIndex = this.sectionIndex.slice(beginningWhitespace, trailingWhitespace);
  }

  substring(start, end) {
    const substring = new TaggedString();
    substring.text = this.text.substring(start, end);
    substring.sectionIndex = this.sectionIndex.slice(start, end);
    substring.sections = this.sections;
    return substring;
  }

  toString() {
    return this.text;
  }

  getMaxScale() {
    return this.sectionIndex.reduce((max, index) => Math.max(max, this.sections[index].scale), 0);
  }
}

function breakLines(input, lineBreakPoints) {
  const lines = [];
  const text = input.text;
  let start = 0;
  for (const lineBreak of lineBreakPoints) {
    lines.push(input.substring(start, lineBreak));
    start = lineBreak;
  }

  if (start < text.length) {
    lines.push(input.substring(start, text.length));
  }
  return lines;
}

export function shapeText(
  text,
  glyphs,
  defaultFontStack,
  maxWidth,
  lineHeight,
  textAnchor,
  textJustify,
  spacing,
  translate,
  writingMode
) {
  const logicalInput = TaggedString.fromFeature(text, defaultFontStack);
  if (writingMode === WritingMode.vertical) {
    logicalInput.verticalizePunctuation();
  }

  let lines;

  const { processBidirectionalText, processStyledBidirectionalText } = rtlTextPlugin;
  if (processBidirectionalText && logicalInput.sections.length === 1) {
    // Bidi doesn't have to be style-aware
    lines = [];
    const untaggedLines = processBidirectionalText(
      logicalInput.toString(),
      determineLineBreaks(logicalInput, spacing, maxWidth, glyphs)
    );
    for (const line of untaggedLines) {
      const taggedLine = new TaggedString();
      taggedLine.text = line;
      taggedLine.sections = logicalInput.sections;
      for (let i = 0; i < line.length; i++) {
        taggedLine.sectionIndex.push(0);
      }
      lines.push(taggedLine);
    }
  } else if (processStyledBidirectionalText) {
    // Need version of mapbox-gl-rtl-text with style support for combining RTL text
    // with formatting
    lines = [];
    const processedLines = processStyledBidirectionalText(
      logicalInput.text,
      logicalInput.sectionIndex,
      determineLineBreaks(logicalInput, spacing, maxWidth, glyphs)
    );
    for (const line of processedLines) {
      const taggedLine = new TaggedString();
      taggedLine.text = line[0];
      taggedLine.sectionIndex = line[1];
      taggedLine.sections = logicalInput.sections;
      lines.push(taggedLine);
    }
  } else {
    lines = breakLines(logicalInput, determineLineBreaks(logicalInput, spacing, maxWidth, glyphs));
  }

  const positionedGlyphs = [];
  const shaping = {
    positionedGlyphs,
    text: logicalInput.toString(),
    top: translate[1],
    bottom: translate[1],
    left: translate[0],
    right: translate[0],
    writingMode,
    lineCount: lines.length
  };

  shapeLines(shaping, glyphs, lines, lineHeight, textAnchor, textJustify, writingMode, spacing);
  if (!positionedGlyphs.length) {
    return false;
  }

  return shaping;
}

const whitespace = {
  [0x09]: true, // tab
  [0x0a]: true, // newline
  [0x0b]: true, // vertical tab
  [0x0c]: true, // form feed
  [0x0d]: true, // carriage return
  [0x20]: true // space
};

const breakable = {
  [0x0a]: true, // newline
  [0x20]: true, // space
  [0x26]: true, // ampersand
  [0x28]: true, // left parenthesis
  [0x29]: true, // right parenthesis
  [0x2b]: true, // plus sign
  [0x2d]: true, // hyphen-minus
  [0x2f]: true, // solidus
  [0xad]: true, // soft hyphen
  [0xb7]: true, // middle dot
  [0x200b]: true, // zero-width space
  [0x2010]: true, // hyphen
  [0x2013]: true, // en dash
  [0x2027]: true // interpunct
  // Many other characters may be reasonable breakpoints
  // Consider "neutral orientation" characters at scriptDetection.charHasNeutralVerticalOrientation
  // See https://github.com/mapbox/mapbox-gl-js/issues/3658
};

function determineAverageLineWidth(logicalInput, spacing, maxWidth, glyphMap) {
  let totalWidth = 0;

  for (let index = 0; index < logicalInput.length(); index++) {
    const section = logicalInput.getSection(index);
    const positions = glyphMap[section.fontStack];
    const glyph = positions?.[logicalInput.getCharCode(index)];
    if (!glyph) {
      continue;
    }
    totalWidth += glyph.metrics.advance * section.scale + spacing;
  }

  const lineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
  return totalWidth / lineCount;
}

function calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) {
  const raggedness = (lineWidth - targetWidth) ** 2;
  if (isLastBreak) {
    // Favor finals lines shorter than average over longer than average
    if (lineWidth < targetWidth) {
      return raggedness / 2;
    }
    return raggedness * 2;
  }

  return raggedness + Math.abs(penalty) * penalty;
}

function calculatePenalty(codePoint, nextCodePoint) {
  let penalty = 0;
  // Force break on newline
  if (codePoint === 0x0a) {
    penalty -= 10000;
  }
  // Penalize open parenthesis at end of line
  if (codePoint === 0x28 || codePoint === 0xff08) {
    penalty += 50;
  }

  // Penalize close parenthesis at beginning of line
  if (nextCodePoint === 0x29 || nextCodePoint === 0xff09) {
    penalty += 50;
  }
  return penalty;
}

function evaluateBreak(breakIndex, breakX, targetWidth, potentialBreaks, penalty, isLastBreak) {
  // We could skip evaluating breaks where the line length (breakX - priorBreak.x) > maxWidth
  //  ...but in fact we allow lines longer than maxWidth (if there's no break points)
  //  ...and when targetWidth and maxWidth are close, strictly enforcing maxWidth can give
  //     more lopsided results.

  let bestPriorBreak = null;
  let bestBreakBadness = calculateBadness(breakX, targetWidth, penalty, isLastBreak);

  for (const potentialBreak of potentialBreaks) {
    const lineWidth = breakX - potentialBreak.x;
    const breakBadness = calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) + potentialBreak.badness;
    if (breakBadness <= bestBreakBadness) {
      bestPriorBreak = potentialBreak;
      bestBreakBadness = breakBadness;
    }
  }

  return {
    index: breakIndex,
    x: breakX,
    priorBreak: bestPriorBreak,
    badness: bestBreakBadness
  };
}

function leastBadBreaks(lastLineBreak) {
  if (!lastLineBreak) {
    return [];
  }
  return leastBadBreaks(lastLineBreak.priorBreak).concat(lastLineBreak.index);
}

function determineLineBreaks(logicalInput, spacing, maxWidth, glyphMap) {
  if (!maxWidth) {
    return [];
  }

  if (!logicalInput) {
    return [];
  }

  const potentialLineBreaks = [];
  const targetWidth = determineAverageLineWidth(logicalInput, spacing, maxWidth, glyphMap);

  let currentX = 0;

  for (let i = 0; i < logicalInput.length(); i++) {
    const section = logicalInput.getSection(i);
    const codePoint = logicalInput.getCharCode(i);
    const positions = glyphMap[section.fontStack];
    const glyph = positions?.[codePoint];

    if (glyph && !whitespace[codePoint]) {
      currentX += glyph.metrics.advance * section.scale + spacing;
    }

    // Ideographic characters, spaces, and word-breaking punctuation that often appear without
    // surrounding spaces.
    if (i < logicalInput.length() - 1 && (breakable[codePoint] || charAllowsIdeographicBreaking(codePoint))) {
      potentialLineBreaks.push(
        evaluateBreak(
          i + 1,
          currentX,
          targetWidth,
          potentialLineBreaks,
          calculatePenalty(codePoint, logicalInput.getCharCode(i + 1)),
          false
        )
      );
    }
  }

  return leastBadBreaks(evaluateBreak(logicalInput.length(), currentX, targetWidth, potentialLineBreaks, 0, true));
}

export function getAnchorAlignment(anchor) {
  let horizontalAlign = 0.5;
  let verticalAlign = 0.5;

  switch (anchor) {
    case 'right':
    case 'top-right':
    case 'bottom-right':
      horizontalAlign = 1;
      break;
    case 'left':
    case 'top-left':
    case 'bottom-left':
      horizontalAlign = 0;
      break;
  }

  switch (anchor) {
    case 'bottom':
    case 'bottom-right':
    case 'bottom-left':
      verticalAlign = 1;
      break;
    case 'top':
    case 'top-right':
    case 'top-left':
      verticalAlign = 0;
      break;
  }

  return { horizontalAlign, verticalAlign };
}

function shapeLines(shaping, glyphMap, lines, lineHeight, textAnchor, textJustify, writingMode, spacing) {
  // the y offset *should* be part of the font metadata
  const yOffset = -17;

  let x = 0;
  let y = yOffset;

  let maxLineLength = 0;
  const positionedGlyphs = shaping.positionedGlyphs;

  const justify = textJustify === 'right' ? 1 : textJustify === 'left' ? 0 : 0.5;

  for (const line of lines) {
    line.trim();

    const lineMaxScale = line.getMaxScale();

    if (!line.length()) {
      y += lineHeight; // Still need a line feed after empty line
      continue;
    }

    const lineStartIndex = positionedGlyphs.length;
    for (let i = 0; i < line.length(); i++) {
      const section = line.getSection(i);
      const codePoint = line.getCharCode(i);
      // We don't know the baseline, but since we're laying out
      // at 24 points, we can calculate how much it will move when
      // we scale up or down.
      const baselineOffset = (lineMaxScale - section.scale) * 24;
      const positions = glyphMap[section.fontStack];
      const glyph = positions?.[codePoint];

      if (!glyph) {
        continue;
      }

      if (!charHasUprightVerticalOrientation(codePoint) || writingMode === WritingMode.horizontal) {
        positionedGlyphs.push({
          glyph: codePoint,
          x,
          y: y + baselineOffset,
          vertical: false,
          scale: section.scale,
          fontStack: section.fontStack
        });
        x += glyph.metrics.advance * section.scale + spacing;
      } else {
        positionedGlyphs.push({
          glyph: codePoint,
          x,
          y: baselineOffset,
          vertical: true,
          scale: section.scale,
          fontStack: section.fontStack
        });
        x += ONE_EM * section.scale + spacing;
      }
    }

    // Only justify if we placed at least one glyph
    if (positionedGlyphs.length !== lineStartIndex) {
      const lineLength = x - spacing;
      maxLineLength = Math.max(lineLength, maxLineLength);

      justifyLine(positionedGlyphs, glyphMap, lineStartIndex, positionedGlyphs.length - 1, justify);
    }

    x = 0;
    y += lineHeight * lineMaxScale;
  }

  const { horizontalAlign, verticalAlign } = getAnchorAlignment(textAnchor);
  align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, lines.length);

  // Calculate the bounding box
  const height = y - yOffset;

  shaping.top += -verticalAlign * height;
  shaping.bottom = shaping.top + height;
  shaping.left += -horizontalAlign * maxLineLength;
  shaping.right = shaping.left + maxLineLength;
}

// justify right = 1, left = 0, center = 0.5
function justifyLine(positionedGlyphs, glyphMap, start, end, justify) {
  if (!justify) {
    return;
  }

  const lastPositionedGlyph = positionedGlyphs[end];
  const positions = glyphMap[lastPositionedGlyph.fontStack];
  const glyph = positions?.[lastPositionedGlyph.glyph];
  if (glyph) {
    const lastAdvance = glyph.metrics.advance * lastPositionedGlyph.scale;
    const lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

    for (let j = start; j <= end; j++) {
      positionedGlyphs[j].x -= lineIndent;
    }
  }
}

function align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, lineCount) {
  const shiftX = (justify - horizontalAlign) * maxLineLength;
  const shiftY = (-verticalAlign * lineCount + 0.5) * lineHeight;

  for (let j = 0; j < positionedGlyphs.length; j++) {
    positionedGlyphs[j].x += shiftX;
    positionedGlyphs[j].y += shiftY;
  }
}

export function shapeIcon(image, iconOffset, iconAnchor) {
  const { horizontalAlign, verticalAlign } = getAnchorAlignment(iconAnchor);
  const dx = iconOffset[0];
  const dy = iconOffset[1];
  const x1 = dx - image.displaySize[0] * horizontalAlign;
  const x2 = x1 + image.displaySize[0];
  const y1 = dy - image.displaySize[1] * verticalAlign;
  const y2 = y1 + image.displaySize[1];
  return { image, top: y1, bottom: y2, left: x1, right: x2 };
}
