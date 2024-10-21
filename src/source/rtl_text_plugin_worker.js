class RTLWorkerPlugin {
  applyArabicShaping = null;
  processBidirectionalText = null;
  processStyledBidirectionalText = null;
  pluginStatus = 'unavailable';
  pluginURL = null;

  setState(state) {
    if (this.isParsed()) {
      return;
    }
    this.pluginStatus = state.pluginStatus;
    this.pluginURL = state.pluginURL;
  }
  getState() {
    return {
      pluginStatus: this.pluginStatus,
      pluginURL: this.pluginURL
    };
  }
  setMethods(rtlTextPlugin) {
    if (this.isParsed()) {
      throw new Error('RTL text plugin already registered.');
    }
    this.applyArabicShaping = rtlTextPlugin.applyArabicShaping;
    this.processBidirectionalText = rtlTextPlugin.processBidirectionalText;
    this.processStyledBidirectionalText = rtlTextPlugin.processStyledBidirectionalText;
  }
  isParsed() {
    return (
      this.applyArabicShaping != null &&
      this.processBidirectionalText != null &&
      this.processStyledBidirectionalText != null
    );
  }
  getRTLTextPluginStatus() {
    return this.pluginStatus;
  }
}

export const rtlWorkerPlugin = new RTLWorkerPlugin();
