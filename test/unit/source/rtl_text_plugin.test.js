import test from 'node:test';
import { rtlPlugin, rtlPluginLoader } from '../../../src/source/rtl_text_plugin.js';
import _window from '../../util/window.js';

test('RTLPlugin', async t => {
  let globalWindow;
  t.before(() => {
    globalWindow = globalThis.window;
    globalThis.window = _window;
  });
  t.beforeEach(() => {
    // This is a static class, so we need to reset the properties before each test
    rtlPluginLoader._clearRTLTextPlugin();
  });
  t.afterEach(() => {
    t.mock.reset();
  });
  t.after(() => {
    globalThis.window = globalWindow;
  });

  await t.test('initial state', t => {
    t.assert.ok(!rtlPlugin.isRTLSupported());
    t.assert.ok(rtlPlugin.isRTLSupported(true));
    t.assert.ok(rtlPlugin.applyArabicShaping == null);
    t.assert.ok(rtlPlugin.processBidirectionalText == null);
    t.assert.ok(rtlPlugin.processStyledBidirectionalText == null);
  });

  await t.test('plugin loaded', async t => {
    const rtlTextPlugin = {
      applyArabicShaping: () => {},
      processBidirectionalText: () => {},
      processStyledBidirectionalText: () => {}
    };
    await rtlPluginLoader.setRTLTextPlugin(() => Promise.resolve(rtlTextPlugin));
    t.assert.ok(rtlPlugin.isRTLSupported());
    t.assert.ok(rtlPlugin.isRTLSupported(true));
    t.assert.equal(rtlPlugin.applyArabicShaping, rtlTextPlugin.applyArabicShaping);
    t.assert.equal(rtlPlugin.processBidirectionalText, rtlTextPlugin.processBidirectionalText);
    t.assert.equal(rtlPlugin.processStyledBidirectionalText, rtlTextPlugin.processStyledBidirectionalText);
  });

  await t.test('plugin deferred', async t => {
    await rtlPluginLoader.setRTLTextPlugin(() => new Promise(), true);
    t.assert.ok(!rtlPlugin.isRTLSupported());
    t.assert.ok(rtlPlugin.isRTLSupported(true));
  });

  await t.test('plugin requested', t => {
    t.assert.ok(rtlPlugin.isRTLSupported(true));
    t.assert.ok(!rtlPlugin.isRTLSupported());
    t.assert.ok(rtlPlugin.isRTLSupported(true));
  });

  await t.test('plugin download failed', async t => {
    try {
      await rtlPluginLoader.setRTLTextPlugin(() => Promise.reject());
    } catch {}
    t.assert.ok(!rtlPlugin.isRTLSupported());
    t.assert.ok(rtlPlugin.isRTLSupported(true));
  });
});
