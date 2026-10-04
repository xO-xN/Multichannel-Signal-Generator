// Locale following (network reference "Locale Following", App ≥ v1.3.0):
// the App pushes {type:'pnds:locale', version:1, locale:…} into the
// monitor page, which holds the locale as its current language and
// re-renders its copy through the bilingual tables in public/copy.js.
// These tests assert the external contract only — message in, locale
// state and notifications out — never the module's internals.

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const {
  localeFromMessage,
  initialLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} = require('../lib/locale-follow')
const copy = require('../public/copy')

const LIB_DIR = path.join(__dirname, '..', 'lib')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

// The message from the network reference "Locale Following", verbatim.
const SPEC_MESSAGE = {
  type: 'pnds:locale',
  version: 1,
  locale: 'zh-CN',
}

// ---------------------------------------------------------------------------
// Message → locale
// ---------------------------------------------------------------------------

test('locale message: supported codes parse, others do not', () => {
  assert.equal(localeFromMessage(SPEC_MESSAGE), 'zh-CN')
  assert.equal(localeFromMessage({ type: 'pnds:locale', version: 1, locale: 'en' }), 'en')

  for (const code of ['ja', 'zh', 'zh-cn', 'en-US', '']) {
    assert.equal(
      localeFromMessage({ type: 'pnds:locale', version: 1, locale: code }),
      null,
      `unsupported code ${JSON.stringify(code)} must be ignored`,
    )
  }
})

test('unknown or malformed messages are ignored, not applied', () => {
  const malformed = [
    null,
    undefined,
    42,
    'pnds:locale',
    [],
    {},
    { type: 'other', version: 1, locale: 'en' },
    { type: 'pnds:locale' },
    { type: 'pnds:locale', version: 2, locale: 'en' },
    { type: 'pnds:locale', version: 1 },
    { type: 'pnds:locale', version: 1, locale: 7 },
    { type: 'pnds:locale', version: 1, locale: ['en'] },
  ]

  for (const data of malformed) {
    assert.equal(localeFromMessage(data), null, `should ignore ${JSON.stringify(data)}`)
  }
})

// ---------------------------------------------------------------------------
// ?lang=<code> first-frame initial locale
// ---------------------------------------------------------------------------

test('?lang= seeds the first frame; absence keeps the default', () => {
  assert.equal(initialLocale('?lang=zh-CN'), 'zh-CN')
  assert.equal(initialLocale('?a=1&lang=en'), 'en')
  assert.equal(initialLocale('?lang=en&theme=stage'), 'en')

  // Unknown codes and missing parameters keep the default locale.
  assert.equal(initialLocale(''), null)
  assert.equal(initialLocale('?'), null)
  assert.equal(initialLocale('?foo=1'), null)
  assert.equal(initialLocale('?lang=ja'), null)
  assert.equal(initialLocale('?lang=zh-cn'), null, 'codes compare exactly')
})

// ---------------------------------------------------------------------------
// Browser wiring (the real file, run against a minimal page)
// ---------------------------------------------------------------------------

// Loads lib/locale-follow.js the way the monitor page does (browser
// global, no module system) and returns what the page observed: its
// locale state, its document lang and its message listeners.
function loadMonitorPage(search) {
  const documentElement = { lang: 'en' }
  const listeners = {}
  const page = {
    document: { documentElement },
    location: { search },
    addEventListener: (type, handler) => {
      (listeners[type] = listeners[type] || []).push(handler)
    },
  }
  page.self = page

  vm.runInContext(
    fs.readFileSync(path.join(LIB_DIR, 'locale-follow.js'), 'utf8'),
    vm.createContext(page),
  )

  return { locale: page.PNDS_LOCALE, documentElement, listeners }
}

test('monitor page wiring: defaults to English until a locale arrives', () => {
  const page = loadMonitorPage('')

  // page.locale is window.PNDS_LOCALE — the global the page script
  // reads, so its very presence proves the browser-global wiring.
  assert.equal(typeof page.locale.current, 'function')
  assert.equal(page.locale.current(), DEFAULT_LOCALE)
  assert.equal(page.locale.current(), 'en')
  assert.equal(page.documentElement.lang, 'en', 'no rewrite before a locale applies')
})

test('monitor page wiring: message → current locale, lang attribute, subscribers', () => {
  const page = loadMonitorPage('')
  const seen = []
  page.locale.subscribe((locale) => seen.push(locale))

  assert.equal(page.listeners.message.length, 1, 'exactly one message listener')

  page.listeners.message[0]({ data: SPEC_MESSAGE })
  assert.equal(page.locale.current(), 'zh-CN')
  assert.equal(page.documentElement.lang, 'zh-CN')
  assert.deepEqual(seen, ['zh-CN'])

  // Back to English (a language switch in the App).
  page.listeners.message[0]({ data: { type: 'pnds:locale', version: 1, locale: 'en' } })
  assert.equal(page.locale.current(), 'en')
  assert.equal(page.documentElement.lang, 'en')
  assert.deepEqual(seen, ['zh-CN', 'en'])
})

test('monitor page wiring: ?lang= paints the first frame before any message', () => {
  const page = loadMonitorPage('?lang=zh-CN')

  assert.equal(page.locale.current(), 'zh-CN')
  assert.equal(page.documentElement.lang, 'zh-CN')
})

test('monitor page wiring: malformed events never throw or change the locale', () => {
  const page = loadMonitorPage('?lang=zh-CN')

  const malformed = [null, {}, { type: 'other' }, 'pnds:locale', { type: 'pnds:locale', version: 1, locale: 'ja' }]
  for (const data of malformed) {
    assert.doesNotThrow(() => page.listeners.message[0]({ data }))
  }

  assert.equal(page.locale.current(), 'zh-CN')
})

// ---------------------------------------------------------------------------
// Idempotency (the App re-pushes on language switches and focus
// regain; latest value wins, repeated delivery has no side effects)
// ---------------------------------------------------------------------------

test('re-delivery is idempotent; switches land on the latest value', () => {
  const page = loadMonitorPage('')
  const seen = []
  page.locale.subscribe((locale) => seen.push(locale))

  const deliver = (locale) =>
    page.listeners.message[0]({ data: { type: 'pnds:locale', version: 1, locale } })

  // Re-push of the current locale (focus regain path) notifies nobody.
  deliver('en')
  deliver('en')
  assert.deepEqual(seen, [])

  deliver('zh-CN')
  deliver('zh-CN')
  assert.deepEqual(seen, ['zh-CN'])

  // A switch away and back lands exactly where it was.
  deliver('en')
  deliver('zh-CN')
  assert.deepEqual(seen, ['zh-CN', 'en', 'zh-CN'])
  assert.equal(page.locale.current(), 'zh-CN')
})

test('unsubscribe stops the notifications', () => {
  const page = loadMonitorPage('')
  const seen = []
  const off = page.locale.subscribe((locale) => seen.push(locale))

  off()
  page.listeners.message[0]({ data: SPEC_MESSAGE })
  assert.deepEqual(seen, [])
  assert.equal(page.locale.current(), 'zh-CN', 'state still follows')
})

// ---------------------------------------------------------------------------
// Copy tables (public/copy.js): every locale renders the same shape
// ---------------------------------------------------------------------------

test('both copy tables share one key shape and non-empty strings', () => {
  assert.deepEqual(keysOf(copy.en), keysOf(copy['zh-CN']))
  assert.deepEqual(Object.keys(copy).sort(), SUPPORTED_LOCALES.slice().sort())

  for (const locale of SUPPORTED_LOCALES) {
    for (const value of Object.values(copy[locale])) {
      assert.equal(typeof value, 'string', `${locale}: copy values are strings`)
      assert.notEqual(value.trim(), '', `${locale}: copy values are non-empty`)
    }
  }
})

test('the English table is the historical page copy, verbatim', () => {
  assert.equal(copy.en.title, 'Multichannel Signal Generator — 16-ch sine wave test')
  assert.equal(copy.en.meta, '16-ch sine wave test — all muted by default')
  assert.equal(copy.en.degradedPrefix + 2 + copy.en.degradedSuffix, '16 tones, host declares 2 output channels')
  assert.equal(copy.en.master, 'Master')
  assert.equal(copy.en.mute, 'Mute')
  assert.equal(copy.en.rackAria, '16 test-tone toggles')
  assert.equal(copy.en.channelAriaPrefix + 3 + copy.en.channelAriaSuffix, 'Channel 3 tone')
  assert.equal(copy.en.qrSub, 'Scan to open the monitor page')
})

test('prefix/suffix pairs assemble in every locale', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const degraded = copy[locale].degradedPrefix + 8 + copy[locale].degradedSuffix
    assert.match(degraded, /8/, `${locale}: the channel count lands inside`)
    const aria = copy[locale].channelAriaPrefix + 16 + copy[locale].channelAriaSuffix
    assert.match(aria, /16/, `${locale}: the channel number lands inside`)
  }
})

// ---------------------------------------------------------------------------
// Monitor page wiring (public/index.html)
// ---------------------------------------------------------------------------

test('the monitor page loads theme-follow, then locale-follow, then copy', () => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')

  const themeAt = html.indexOf('/__pnds/theme-follow.js')
  const localeAt = html.indexOf('/__pnds/locale-follow.js')
  const copyAt = html.indexOf('src="/copy.js"')
  assert.ok(themeAt >= 0, 'theme-follow.js is referenced')
  assert.ok(localeAt > themeAt, 'locale-follow.js loads after theme-follow.js')
  assert.ok(copyAt > localeAt, 'copy.js loads after locale-follow.js')

  // The page re-renders through the bridge on every switch.
  assert.match(html, /PNDS_LOCALE\.subscribe/)
})

test('the static HTML carries the English defaults', () => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')

  // No-JS and first-frame fallback: the markup itself holds the
  // historical English copy (the "en" table, verbatim).
  assert.match(html, /<title>Multichannel Signal Generator — 16-ch sine wave test<\/title>/)
  assert.match(html, /16-ch sine wave test — all muted by default/)
  assert.match(html, />Master<\/label>/)
  assert.match(html, /Scan to open the monitor page/)
  assert.match(html, /aria-label="16 test-tone toggles"/)
  assert.match(html, /<html lang="en">/)
})

// ---------------------------------------------------------------------------
// Page script (public/index.html's inline script, run against a minimal DOM)
// ---------------------------------------------------------------------------

// A DOM element stub covering everything the page script touches.
function fakeElement(id) {
  const children = []
  const listeners = {}
  const element = {
    id,
    children,
    listeners,
    textContent: '',
    className: '',
    type: '',
    value: undefined,
    classList: {
      contains: (name) => element.className.split(/\s+/).filter(Boolean).includes(name),
      toggle: (name, force) => {
        const on = force !== undefined ? force : !element.classList.contains(name)
        const set = new Set(element.className.split(/\s+/).filter(Boolean))
        if (on) set.add(name)
        else set.delete(name)
        element.className = [...set].join(' ')
      },
    },
    setAttribute: (name, value) => {
      element.attributes[name] = String(value)
    },
    appendChild: (child) => {
      children.push(child)
      return child
    },
    append: (...nodes) => {
      children.push(...nodes)
    },
    addEventListener: (type, handler) => {
      (listeners[type] = listeners[type] || []).push(handler)
    },
  }
  element.attributes = {}
  return element
}

// Boots the monitor page the way a browser would: locale-follow.js
// (self-wiring bridge), copy.js (tables) and the page's inline script,
// all in one context, over a minimal DOM. /api/state answers with a
// degraded 2-channel host so the re-render path is exercised too.
function loadPageScript(search, outputChannels = 2) {
  const messageListeners = []
  const requests = []
  const byId = {}
  const element = (id) => (byId[id] = byId[id] || fakeElement(id))
  const documentElement = { lang: 'en' }

  const sandbox = {
    document: {
      documentElement,
      createElement: (tag) => fakeElement(tag),
      getElementById: (id) => element(id),
    },
    location: { search },
    fetch: (url, options) => {
      requests.push({ url, options })
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ outputChannels }) })
    },
    addEventListener: (type, handler) => {
      if (type === 'message') {
        messageListeners.push(handler)
      }
    },
  }
  sandbox.self = sandbox

  // The static markup's fader position (value="900" → −6 dBFS), present
  // before the script reads it.
  element('master').value = '900'

  const context = vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(LIB_DIR, 'locale-follow.js'), 'utf8'), context)
  vm.runInContext(fs.readFileSync(path.join(PUBLIC_DIR, 'copy.js'), 'utf8'), context)

  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)
  assert.ok(inline, 'the page has one inline script block')
  vm.runInContext(inline[1], context)

  return { document: sandbox.document, byId, documentElement, messageListeners, requests }
}

// Lets the stubbed /api/state promise chain run out.
function settle() {
  return new Promise((resolve) => setImmediate(resolve))
}

test('page script: renders the English defaults, then follows locale switches live', async () => {
  const page = loadPageScript('')

  // First frame (before any bridge traffic or /api/state reply).
  assert.equal(page.byId.meta.textContent, '16-ch sine wave test — all muted by default')
  assert.equal(page.byId['master-label'].textContent, 'Master')
  assert.equal(page.byId.master.attributes['aria-label'], 'Master volume')
  assert.equal(page.byId['master-value'].textContent, '-6.0 dBFS')
  assert.equal(page.byId.rack.attributes['aria-label'], '16 test-tone toggles')
  assert.equal(page.byId.rack.children.length, 16, 'the rack holds 16 tone buttons')
  assert.equal(page.byId.rack.children[2].attributes['aria-label'], 'Channel 3 tone')
  assert.equal(page.byId['qr-img'].attributes['alt'], 'QR code for the monitor page')
  assert.equal(page.byId['qr-sub'].textContent, 'Scan to open the monitor page')

  // The App switches its language → everything re-renders in Chinese.
  page.messageListeners[0]({ data: { type: 'pnds:locale', version: 1, locale: 'zh-CN' } })
  assert.equal(page.document.title, 'Multichannel Signal Generator — 16 声道正弦波测试')
  assert.equal(page.byId.meta.textContent, '16 声道正弦波测试——默认全部静音')
  assert.equal(page.byId['master-label'].textContent, '主音量')
  assert.equal(page.byId.master.attributes['aria-label'], '主音量')
  assert.equal(page.byId.rack.attributes['aria-label'], '16 个测试音开关')
  assert.equal(page.byId.rack.children[2].attributes['aria-label'], '第 3 声道测试音')
  assert.equal(page.byId['qr-sub'].textContent, '扫码打开监视器页面')
  assert.equal(page.documentElement.lang, 'zh-CN')

  // The Mute word follows the locale too.
  page.byId.master.value = '0'
  for (const handler of page.byId.master.listeners.input) handler()
  assert.equal(page.byId['master-value'].textContent, '静音')

  // The degraded host declaration lands later, still in Chinese.
  await settle()
  assert.equal(page.byId.meta.textContent, '16 个测试音，宿主仅声明 2 个输出声道')

  // Malformed messages change nothing.
  page.messageListeners[0]({ data: null })
  page.messageListeners[0]({ data: { type: 'other', version: 1, locale: 'en' } })
  assert.equal(page.byId['qr-sub'].textContent, '扫码打开监视器页面')
  assert.equal(page.byId.meta.textContent, '16 个测试音，宿主仅声明 2 个输出声道')
})

test('page script: ?lang= seeds the first frame before any message', () => {
  const page = loadPageScript('?lang=zh-CN&theme=stage')

  assert.equal(page.document.title, 'Multichannel Signal Generator — 16 声道正弦波测试')
  assert.equal(page.byId.meta.textContent, '16 声道正弦波测试——默认全部静音')
  assert.equal(page.byId.rack.children[0].attributes['aria-label'], '第 1 声道测试音')
  assert.equal(page.byId['qr-sub'].textContent, '扫码打开监视器页面')
  assert.equal(page.documentElement.lang, 'zh-CN')
})

test('instrument: starts with all 16 tones off and never sends an audio command on load', async () => {
  const page = loadPageScript('', 16)
  await settle()

  assert.equal(page.byId['active-count'].textContent, '00')
  assert.equal(page.byId['frequency-range'].textContent, '440–1047 Hz')
  for (const tone of page.byId.rack.children) {
    assert.equal(tone.attributes['aria-pressed'], 'false')
    assert.equal(tone.children[3].children[0].textContent, 'OFF')
  }
  assert.equal(page.byId.rack.children[0].children[2].textContent, '440.0 Hz')
  assert.equal(page.byId.rack.children[12].children[2].textContent, '880.0 Hz')
  assert.equal(page.byId.master.attributes['aria-valuetext'], '-6.0 dBFS')
  assert.deepEqual(page.requests.map(({ url }) => url), ['/api/state'])
})

test('instrument: channel toggles update the count, visible state and existing tone API', () => {
  const page = loadPageScript('', 16)
  const first = page.byId.rack.children[0]
  const last = page.byId.rack.children[15]
  first.listeners.click[0]()
  last.listeners.click[0]()

  assert.equal(page.byId['active-count'].textContent, '02')
  assert.equal(first.attributes['aria-pressed'], 'true')
  assert.equal(first.children[3].children[0].textContent, 'ON')
  first.listeners.click[0]()
  assert.equal(page.byId['active-count'].textContent, '01')
  assert.equal(first.attributes['aria-pressed'], 'false')
  assert.equal(first.children[3].children[0].textContent, 'OFF')

  const commands = page.requests.filter(({ options }) => options?.method === 'POST')
  assert.ok(commands.every(({ url }) => url === '/api/tone'))
  assert.deepEqual(commands.map(({ options }) => JSON.parse(options.body)), [
    { channel: 1, on: true }, { channel: 16, on: true }, { channel: 1, on: false },
  ])
})

test('instrument: a language switch translates states and controls without changing enabled tones', () => {
  const page = loadPageScript('', 16)
  const first = page.byId.rack.children[0]
  first.listeners.click[0]()
  const requestsBefore = page.requests.length

  page.messageListeners[0]({ data: SPEC_MESSAGE })
  assert.equal(first.attributes['aria-pressed'], 'true')
  assert.equal(first.children[3].children[0].textContent, '开启')
  assert.equal(page.byId.rack.children[1].children[3].children[0].textContent, '关闭')
  assert.equal(page.byId['active-count'].textContent, '01')
  assert.equal(page.byId['activity-label'].textContent, '已开启声道')
  assert.equal(page.byId['tones-label'].textContent, '测试音')
  assert.equal(page.byId['master-note'].textContent, '控制所有已开启的测试音')
  assert.equal(page.byId['scale-mute'].textContent, '静音')
  assert.equal(page.byId['remote-label'].textContent, '手机控制')
  assert.equal(page.requests.length, requestsBefore)
})

test('instrument: master endpoints preserve the gain API and expose readable values to assistive technology', () => {
  const page = loadPageScript('', 16)
  for (const [position, label] of [['0', 'Mute'], ['1000', '0.0 dBFS'], ['500', '-30.0 dBFS']]) {
    page.byId.master.value = position
    page.byId.master.listeners.input[0]()
    assert.equal(page.byId['master-value'].textContent, label)
    assert.equal(page.byId.master.attributes['aria-valuetext'], label)
  }
  const commands = page.requests.filter(({ url }) => url === '/api/master')
  assert.deepEqual(commands.map(({ options }) => JSON.parse(options.body)), [
    { value: 0 }, { value: 1 }, { value: 0.5 },
  ])
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Key shape of a plain-object structure (leaf values → null, so only
// the shape compares).
function keysOf(value) {
  const out = {}
  for (const key of Object.keys(value).sort()) {
    out[key] = null
  }
  return out
}
