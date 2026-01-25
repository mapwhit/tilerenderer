import test from 'node:test';
import { rtlPluginLoader } from '../../../src/source/rtl_text_plugin.js';
import { sleep } from '../../util/util.js';

test('RTLPluginLoader', async t => {
  t.beforeEach(() => {
    // Reset the singleton instance before each test
    rtlPluginLoader._clearRTLTextPlugin();
  });
  t.afterEach(() => {
    t.mock.reset();
  });

  await t.test('should get the RTL text plugin status', t => {
    const status = rtlPluginLoader.getRTLTextPluginStatus();
    t.assert.equal(status, 'unavailable');
  });

  await t.test('should set the RTL text plugin and download it', async t => {
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.resolve({}));
    t.assert.deepEqual(rtlPluginLoader.getRTLTextPluginStatus(), 'loaded');
  });

  await t.test('should set the RTL text plugin but defer downloading', async t => {
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.resolve({}), true);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'deferred');
  });

  await t.test('should throw if the plugin is already set', async t => {
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.resolve({}), true);
    await t.assert.rejects(
      rtlPluginLoader.setRTLTextPlugin(() => Promise.resolve({})),
      {
        message: 'setRTLTextPlugin cannot be called multiple times.'
      }
    );
  });

  await t.test('should reject if the plugin load function is not set', async t => {
    await t.assert.rejects(rtlPluginLoader.setRTLTextPlugin(null), {
      message: 'RTL text plugin load function is not set.'
    });
  });

  await t.test('should be in error state if load fails', async t => {
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.reject());
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'error');
  });

  await t.test('should lazy load the plugin if deferred', async t => {
    const loadFn = t.mock.fn(() => Promise.resolve({}));
    await rtlPluginLoader.setRTLTextPlugin(loadFn, true);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'deferred');
    await rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'loaded');
    t.assert.equal(loadFn.mock.callCount(), 1);
  });

  await t.test('should set status to requested if RTL plugin was not set', t => {
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
  });

  await t.test('should immediately download if RTL plugin was already requested, ignoring deferred:true', async t => {
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
    await sleep(1);
    // notice even when deferred is true, it should download because already requested
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.resolve(), true);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'loaded');
  });

  await t.test('should allow multiple calls to lazyLoad', t => {
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
    rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'requested');
  });

  await t.test('should be in error state if lazyLoad fails', async t => {
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.reject(), true);
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'deferred');
    // the next one should fail
    await rtlPluginLoader.lazyLoad();
    t.assert.equal(rtlPluginLoader.getRTLTextPluginStatus(), 'error');
  });
});
