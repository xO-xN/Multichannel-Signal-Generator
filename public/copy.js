// Bilingual UI copy (en / zh-CN) for the monitor page — the tables
// public/index.html renders through, keyed by the locale the App
// pushes over the locale bridge (lib/locale-follow.js).
//
// Keys are language-neutral; values may be plain strings or
// prefix/suffix pairs around dynamic parts (channel numbers, host
// channel counts). The "en" table is the page's historical copy,
// verbatim — a session with no locale traffic renders exactly as
// before. test/locale-follow.test.js asserts both tables share one
// key shape, so a key added to one language cannot be forgotten in
// the other.
//
// UMD-shaped like lib/theme-follow.js: a browser global
// (window.PNDS_COPY) and a Node module for tests. Unlike the bridge
// modules it is project-specific (not a copy-style reference), so it
// lives in public/ and is served as a plain static file — the monitor
// page loads it next to /__pnds/locale-follow.js.

(function (root, factory) {
  const api = factory()

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
    return
  }

  root.PNDS_COPY = api
})(typeof self !== 'undefined' ? self : this, () => {
  const copy = {
    en: {
      title: 'Multichannel Signal Generator — 16-ch sine wave test',
      meta: '16-ch sine wave test — all muted by default',
      degradedPrefix: '16 tones, host declares ',
      degradedSuffix: ' output channels',
      master: 'Master',
      masterAria: 'Master volume',
      mute: 'Mute',
      rackAria: '16 test-tone toggles',
      channelAriaPrefix: 'Channel ',
      channelAriaSuffix: ' tone',
      qrAlt: 'QR code for the monitor page',
      qrSub: 'Scan to open the monitor page',
    },
    'zh-CN': {
      title: 'Multichannel Signal Generator — 16 声道正弦波测试',
      meta: '16 声道正弦波测试——默认全部静音',
      degradedPrefix: '16 个测试音，宿主仅声明 ',
      degradedSuffix: ' 个输出声道',
      master: '主音量',
      masterAria: '主音量',
      mute: '静音',
      rackAria: '16 个测试音开关',
      channelAriaPrefix: '第 ',
      channelAriaSuffix: ' 声道测试音',
      qrAlt: '监视器页面二维码',
      qrSub: '扫码打开监视器页面',
    },
  }

  return copy
})
