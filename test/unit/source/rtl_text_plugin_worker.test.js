import test from 'node:test';
import { rtlWorkerPlugin } from '../../../src/source/rtl_text_plugin_worker.js';

test('RTLWorkerPlugin', async t => {
  t.beforeEach(() => {
    // This is a static class, so we need to reset the properties before each test
    rtlWorkerPlugin.processStyledBidirectionalText = null;
    rtlWorkerPlugin.processBidirectionalText = null;
    rtlWorkerPlugin.applyArabicShaping = null;
  });

  await t.test('should throw if already parsed', t => {
    const rtlTextPlugin = {
      applyArabicShaping: () => {},
      processBidirectionalText: () => {},
      processStyledBidirectionalText: () => {}
    };
    rtlWorkerPlugin.setMethods(rtlTextPlugin);
    t.assert.throws(() => rtlWorkerPlugin.setMethods(rtlTextPlugin), {
      message: 'RTL text plugin already registered.'
    });
  });

  await t.test('should move RTL plugin from unavailable to deferred', t => {
    rtlWorkerPlugin.pluginURL = '';
    rtlWorkerPlugin.pluginStatus = 'unavailable';
    const mockMessage = {
      pluginURL: 'https://somehost/somescript',
      pluginStatus: 'deferred'
    };
    rtlWorkerPlugin.setState(mockMessage);
    t.assert.equal(rtlWorkerPlugin.getRTLTextPluginStatus(), 'deferred');
  });

  await t.test('should not change RTL plugin status if already parsed', t => {
    const originalUrl = 'https://somehost/somescript1';
    rtlWorkerPlugin.pluginURL = originalUrl;
    rtlWorkerPlugin.pluginStatus = 'loaded';
    rtlWorkerPlugin.setMethods({
      applyArabicShaping: () => {},
      processBidirectionalText: () => {},
      processStyledBidirectionalText: () => {}
    });
    const mockMessage = {
      pluginURL: 'https://somehost/somescript2',
      pluginStatus: 'loading'
    };
    rtlWorkerPlugin.setState(mockMessage);
    t.assert.equal(rtlWorkerPlugin.getRTLTextPluginStatus(), 'loaded');
    t.assert.equal(rtlWorkerPlugin.pluginURL, originalUrl);
  });
});
