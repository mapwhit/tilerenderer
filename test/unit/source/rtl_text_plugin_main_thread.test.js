import test from 'node:test';
import { rtlMainThreadPluginFactory } from '../../../src/source/rtl_text_plugin_main_thread.js';
import browser from '../../../src/util/browser.js';
import { sleep } from '../../util/util.js';
import _window from '../../util/window.js';

const rtlMainThreadPlugin = rtlMainThreadPluginFactory();
test('RTLMainThreadPlugin', async t => {
  let globalWindow;
  const url = 'http://example.com/plugin';
  const failedToLoadMessage = `RTL Text Plugin failed to import scripts from ${url}`;
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
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    const promise = rtlMainThreadPlugin.setRTLTextPlugin(url);
    await sleep(0);
    await promise;
    t.assert.equal(rtlMainThreadPlugin.url, url);
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 1);
  });

  await t.test('should set the RTL text plugin but defer downloading', async t => {
    t.mock.method(rtlMainThreadPlugin, 'loadScript');
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 0);
    t.assert.equal(rtlMainThreadPlugin.status, 'deferred');
  });

  await t.test('should throw if the plugin is already set', async t => {
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    await t.assert.rejects(rtlMainThreadPlugin.setRTLTextPlugin(url), {
      message: 'setRTLTextPlugin cannot be called multiple times.'
    });
  });

  await t.test('should throw if the plugin url is not set', async t => {
    t.mock.method(browser, 'resolveURL', () => '');
    await t.assert.rejects(rtlMainThreadPlugin.setRTLTextPlugin(null), {
      message: 'requested url null is invalid'
    });
  });

  await t.test('should be in error state if download fails', async t => {
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => Promise.reject());
    await t.assert.rejects(rtlMainThreadPlugin.setRTLTextPlugin(url), {
      message: failedToLoadMessage
    });
    t.assert.equal(rtlMainThreadPlugin.url, url);
    t.assert.equal(rtlMainThreadPlugin.status, 'error');
  });

  await t.test('should lazy load the plugin if deferred', async t => {
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 0);
    t.assert.equal(rtlMainThreadPlugin.status, 'deferred');
    const promise = rtlMainThreadPlugin.lazyLoad();
    await sleep(0);
    await promise;
    t.assert.equal(rtlMainThreadPlugin.status, 'loaded');
    t.assert.equal(rtlMainThreadPlugin.loadScript.mock.callCount(), 1);
  });

  await t.test('should set status to requested if RTL plugin was not set', t => {
    rtlMainThreadPlugin.lazyLoad();
    t.assert.equal(rtlMainThreadPlugin.status, 'requested');
  });

  await t.test('should immediately download if RTL plugin was already requested, ignoring deferred:true', async t => {
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => {
      globalThis.registerRTLTextPlugin({});
      return Promise.resolve();
    });
    rtlMainThreadPlugin.lazyLoad();
    t.assert.equal(rtlMainThreadPlugin.status, 'requested');
    await sleep(1);
    // notice even when deferred is true, it should download because already requested
    await rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    t.assert.equal(rtlMainThreadPlugin.status, 'loaded');
  });

  await t.test('should allow multiple calls to lazyLoad', t => {
    rtlMainThreadPlugin.lazyLoad();
    t.assert.equal(rtlMainThreadPlugin.status, 'requested');
    rtlMainThreadPlugin.lazyLoad();
    t.assert.equal(rtlMainThreadPlugin.status, 'requested');
  });

  await t.test('should be in error state if lazyLoad fails', async t => {
    const resultPromise = rtlMainThreadPlugin.setRTLTextPlugin(url, true);
    t.assert.equal(await resultPromise, undefined);
    t.assert.equal(rtlMainThreadPlugin.status, 'deferred');
    // the next one should fail
    t.mock.method(rtlMainThreadPlugin, 'loadScript', () => Promise.reject());
    await t.assert.rejects(rtlMainThreadPlugin.lazyLoad(), {
      message: failedToLoadMessage
    });
    t.assert.equal(rtlMainThreadPlugin.url, url);
    t.assert.equal(rtlMainThreadPlugin.status, 'error');
  });
});
