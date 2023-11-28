import test from 'node:test';
import { rtlMainThreadPluginFactory } from '../../../src/source/rtl_text_plugin_main_thread.js';
import browser from '../../../src/util/browser.js';
import { sleep } from '../../util/util.js';
import _window from '../../util/window.js';

const rtlMainThreadPlugin = rtlMainThreadPluginFactory();
test('RTLMainThreadPlugin', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.beforeEach(() => {
    // Reset the singleton instance before each test
    rtlMainThreadPlugin.clearRTLTextPlugin();
  });
  t.afterEach(() => {
    t.mock.reset();
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('should get the RTL text plugin status', t => {
    const status = rtlMainThreadPlugin.getRTLTextPluginStatus();
    t.assert.equal(status, 'unavailable');
  });

  await t.test('should set the RTL text plugin and download it', async t => {
    const url = 'http://example.com/plugin';
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    const promise = rtlMainThreadPlugin.setRTLTextPlugin(url);
    await sleep(0);
    await promise;
    t.assert.equal(rtlMainThreadPlugin.pluginURL, url);
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 1);
  });

  await t.test('should set the RTL text plugin but deffer downloading', async t => {
    const url = 'http://example.com/plugin';
    t.mock.method(rtlMainThreadPlugin, 'loadScript');
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 0);
    t.assert.equal(rtlMainThreadPlugin.pluginStatus, 'deferred');
  });

  await t.test('should throw if the plugin is already set', async t => {
    const url = 'http://example.com/plugin';
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    await t.assert.rejects(rtlMainThreadPlugin.setRTLTextPlugin(url), {
      message: 'setRTLTextPlugin cannot be called multiple times.'
    });
  });

  await t.test('should throw if the plugin url is not set', async t => {
    t.mock.method(browser, 'resolveURL', () => '');
    await t.assert.rejects(rtlMainThreadPlugin.setRTLTextPlugin(null), {
      message: 'rtl-text-plugin cannot be downloaded unless a pluginURL is specified'
    });
  });

  await t.test('should be in error state if download fails', async t => {
    const url = 'http://example.com/plugin';
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => Promise.reject());
    const promise = rtlMainThreadPlugin.setRTLTextPlugin(url);
    await sleep(0);
    await promise;
    t.assert.equal(rtlMainThreadPlugin.pluginURL, url);
    t.assert.equal(rtlMainThreadPlugin.pluginStatus, 'error');
  });

  await t.test('should lazy load the plugin if deffered', async t => {
    const url = 'http://example.com/plugin';
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 0);
    t.assert.equal(rtlMainThreadPlugin.pluginStatus, 'deferred');
    const promise = rtlMainThreadPlugin.lazyLoadRTLTextPlugin();
    await sleep(0);
    await promise;
    t.assert.equal(rtlMainThreadPlugin.pluginStatus, 'loaded');
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 1);
  });
});
