const BACK = 0x0405;
const CCW = 0x0901;

class CullFaceMode {
  enable;
  mode;
  frontFace;

  constructor(enable, mode, frontFace) {
    this.enable = enable;
    this.mode = mode;
    this.frontFace = frontFace;
  }

  static disabled;
  static backCCW;
}

CullFaceMode.disabled = new CullFaceMode(false, BACK, CCW);
CullFaceMode.backCCW = new CullFaceMode(true, BACK, CCW);

export default CullFaceMode;
