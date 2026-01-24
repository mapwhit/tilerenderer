import test from 'node:test';
import { rtlPlugin, rtlPluginLoader } from '../../../src/source/rtl_text_plugin.js';
import browser from '../../../src/util/browser.js';
import { sleep } from '../../util/util.js';
import _window from '../../util/window.js';

test('RTLPluginLoader', async t => {
  let globalWindow;
  const url = 'http://example.com/plugin';
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.beforeEach(() => {
    // Reset the singleton instance before each test
    rtlPluginLoader._clearRTLTextPlugin();
  });
  t.afterEach(() => {
    t.mock.reset();
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('should get the RTL text plugin status', t => {
    const status = rtlPluginLoader.getRTLTextPluginStatus();
    t.assert.equal(status, 'unavailable');
  });

  await t.test('should set the RTL text plugin and download it', async t => {
    t.mock.method(rtlPluginLoader, '_loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    const promise = rtlPluginLoader.setRTLTextPlugin(url);
    await sleep(0);
    await promise;
    t.assert.deepEqual(rtlPluginLoader.getRTLTextPluginStatus(), 'loaded');
    t.assert.equal(rtlPluginLoader._loadScript.mock.callCount(), 1);
  });

  await t.test('should set the RTL text plugin but defer downloading', async t => {
    t.mock.method(rtlPluginLoader, '_loadScript');
    await rtlPluginLoader.setRTLTextPlugin(url, true);
    t.assert.equal(rtlPluginLoader._loadScript.mock.callCount(), 0);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'deferred');
  });

  await t.test('should throw if the plugin is already set', async t => {
    await rtlPluginLoader.setRTLTextPlugin(url, true);
    await t.assert.rejects(rtlPluginLoader.setRTLTextPlugin(url), {
      message: 'setRTLTextPlugin cannot be called multiple times.'
    });
  });

  await t.test('should throw if the plugin url is not set', async t => {
    t.mock.method(browser, 'resolveURL', () => '');
    await t.assert.rejects(rtlPluginLoader.setRTLTextPlugin(null), {
      message: 'requested url null is invalid'
    });
  });

  await t.test('should be in error state if download fails', async t => {
    t.mock.method(rtlPluginLoader, '_loadScript', () => Promise.reject());
    await rtlPluginLoader.setRTLTextPlugin(url);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'error');
  });

  await t.test('should lazy load the plugin if deferred', async t => {
    t.mock.method(rtlPluginLoader, '_loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    await rtlPluginLoader.setRTLTextPlugin(url, true);
    t.assert.equal(rtlPluginLoader._loadScript.mock.callCount(), 0);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'deferred');
    const promise = rtlPluginLoader.lazyLoad();
    await sleep(0);
    await promise;
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'loaded');
    t.assert.equal(rtlPluginLoader._loadScript.mock.callCount(), 1);
  });

  await t.test('should set status to requested if RTL plugin was not set', t => {
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
  });

  await t.test('should immediately download if RTL plugin was already requested, ignoring deferred:true', async t => {
    t.mock.method(rtlPluginLoader, '_loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
    await sleep(1);
    // notice even when deferred is true, it should download because already requested
    await rtlPluginLoader.setRTLTextPlugin(url, true);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'loaded');
  });

  await t.test('should allow multiple calls to lazyLoad', t => {
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
  });

  await t.test('should be in error state if lazyLoad fails', async t => {
    const resultPromise = rtlPluginLoader.setRTLTextPlugin(url, true);
    t.assert.equal(await resultPromise, undefined);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'deferred');
    // the next one should fail
    t.mock.method(rtlPluginLoader, '_loadScript', () => Promise.reject());
    await rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'error');
  });

  await t.test('should throw if already parsed', t => {
    const rtlTextPlugin = {
      applyArabicShaping: () => {},
      processBidirectionalText: () => {},
      processStyledBidirectionalText: () => {}
    };
    globalThis.registerRTLTextPlugin(rtlTextPlugin);
    t.assert.throws(() => globalThis.registerRTLTextPlugin(rtlTextPlugin), {
      message: 'RTL text plugin already registered.'
    });
  });

  await t.test('should not change RTL plugin status if already parsed', t => {
    const rtlTextPlugin = {
      applyArabicShaping: () => {},
      processBidirectionalText: () => {},
      processStyledBidirectionalText: () => {}
    };
    globalThis.registerRTLTextPlugin(rtlTextPlugin);
    const rtlTextPlugin2 = {
      applyArabicShaping: () => {},
      processBidirectionalText: () => {},
      processStyledBidirectionalText: () => {}
    };
    try {
      globalThis.registerRTLTextPlugin(rtlTextPlugin2);
    } catch {}
    t.assert.equal(rtlPlugin.applyArabicShaping, rtlTextPlugin.applyArabicShaping);
    t.assert.equal(rtlPlugin.processBidirectionalText, rtlTextPlugin.processBidirectionalText);
    t.assert.equal(rtlPlugin.processStyledBidirectionalText, rtlTextPlugin.processStyledBidirectionalText);
  });
});
