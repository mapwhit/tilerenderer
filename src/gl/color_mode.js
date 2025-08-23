import { Color } from '@mapwhit/style-expressions';

const ZERO = 0x0000;
const ONE = 0x0001;
const ONE_MINUS_SRC_ALPHA = 0x0303;

class ColorMode {
  static Replace = [ONE, ZERO];

  static disabled = new ColorMode(ColorMode.Replace, Color.transparent, [false, false, false, false]);
  static unblended = new ColorMode(ColorMode.Replace, Color.transparent, [true, true, true, true]);
  static alphaBlended = new ColorMode([ONE, ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);

  constructor(blendFunction, blendColor, mask) {
    this.blendFunction = blendFunction;
    this.blendColor = blendColor;
    this.mask = mask;
  }
}

export default ColorMode;
