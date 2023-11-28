import { rtlWorkerPlugin } from '../source/rtl_text_plugin_worker.js';
import { isStringInSupportedScript } from '../util/script_detection.js';
import ZoomHistory from './zoom_history.js';

export default class EvaluationParameters {
  // "options" may also be another EvaluationParameters to copy, see CrossFadedProperty.possiblyEvaluate
  constructor(zoom, options) {
    this.zoom = zoom;
    this.isSupportedScript = isSupportedScript;

    if (options) {
      this.now = options.now || 0;
      this.fadeDuration = options.fadeDuration || 0;
      this.zoomHistory = options.zoomHistory || new ZoomHistory();
      this.transition = options.transition || {};
    } else {
      this.now = 0;
      this.fadeDuration = 0;
      this.zoomHistory = new ZoomHistory();
      this.transition = {};
    }
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

function isSupportedScript(str) {
  return isStringInSupportedScript(str, rtlWorkerPlugin.getRTLTextPluginStatus() === 'loaded');
}
