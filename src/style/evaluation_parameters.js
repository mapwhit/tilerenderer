const ZoomHistory = require('./zoom_history');
const { isStringInSupportedScript } = require('../util/script_detection');
const { plugin: rtlTextPlugin } = require('../source/rtl_text_plugin');

class EvaluationParameters {
  // "options" may also be another EvaluationParameters to copy, see CrossFadedProperty.possiblyEvaluate
  constructor(zoom, options) {
    this.zoom = zoom;

    if (options) {
      this.now = options.now || 0;
      this.fadeDuration = options.fadeDuration || 0;
      this.zoomHistory = options.zoomHistory || new ZoomHistory();
      this.transition = options.transition || {};
      this.globalState = options.globalState || {};
    } else {
      this.now = 0;
      this.fadeDuration = 0;
      this.zoomHistory = new ZoomHistory();
      this.transition = {};
      this.globalState = {};
    }
  }

  isSupportedScript(str) {
    return isStringInSupportedScript(str, rtlTextPlugin.isLoaded());
  }

  crossFadingFactor() {
    if (this.fadeDuration === 0) {
      return 1;
    }
    return Math.min((this.now - this.zoomHistory.lastIntegerZoomTime) / this.fadeDuration, 1);
  }

  getCrossfadeParameters() {
    const z = this.zoom;
    const fraction = z - Math.floor(z);
    const t = this.crossFadingFactor();

    return z > this.zoomHistory.lastIntegerZoom
      ? { fromScale: 2, toScale: 1, t: fraction + (1 - fraction) * t }
      : { fromScale: 0.5, toScale: 1, t: 1 - (1 - t) * fraction };
  }
}

module.exports = EvaluationParameters;
