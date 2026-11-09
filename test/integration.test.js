// Multichannel Signal Generator integration tests: manifest contract, HTTP routes,
// health payload, fader API validation, QR endpoint, and graceful shutdown.
// These start the real server against a fake scsynth (no audio device) so
// the suite runs anywhere without audio hardware.

'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const { create: createControls } = require('../public/control-client')

const PROJECT_ROOT = path.join(__dirname, '..')

// ---------------------------------------------------------------------------
// Manifest contract (docs/PNDS_SCORE_PROJECT_SPECIFICATION.md)
// ---------------------------------------------------------------------------

test('manifest satisfies the score-project contract', () => {
  const manifest = require('../manifest.json')
  assert.equal(manifest.schemaVersion, 2)
  assert.equal(manifest.id, 'multichannel-signal-generator')
  assert.ok(manifest.scoreServer.entry.endsWith('server.js'))
  assert.equal(manifest.audio.defaultMode, 'internal')
  assert.deepEqual(manifest.audio.supportedModes, ['internal'])
  assert.equal(manifest.audio.outputChannels, 16)
  assert.ok(manifest.audio.scsynth.audioBusChannels >= 32)
  assert.notEqual(
    manifest.scoreServer.performerPort,
    manifest.scoreServer.monitorPort
  )
  // Compiled runtime artifact ships with the project.
  for (const synthdef of manifest.audio.synthdefs) {
    const artifact = path.join(PROJECT_ROOT, synthdef)
    assert.ok(fs.existsSync(artifact), `missing artifact: ${synthdef}`)
    assert.ok(artifact.endsWith('.scsyndef'))
  }
})

test('manifest passes the App preflight with its production dependency installed', () => {
  const packageJson = require('../package.json')
  const dependencies = packageJson.dependencies || {}
  const optionalDependencies = packageJson.optionalDependencies || {}
  // The only production dependency is qrcode (QR endpoint on the monitor).
  assert.deepEqual(Object.keys(dependencies), [])
  assert.equal(Object.keys(optionalDependencies).length, 0)
  // Preflight rule (spec §2): production deps present -> node_modules must
  // ship with the project so the App never runs an install step.
  for (const dependency of Object.keys(dependencies)) {
    assert.ok(
      fs.existsSync(path.join(PROJECT_ROOT, 'node_modules', dependency)),
      `missing installed dependency: ${dependency}`
    )
  }
  // The project pins the runtime it was validated on (spec §2).
  assert.equal(packageJson.engines.node, '>=24 <25')
})

// ---------------------------------------------------------------------------
// Server harness
// ---------------------------------------------------------------------------

const net = require('node:net')
const dgram = require('node:dgram')

/** Allocates a free local TCP port (released immediately; races are
 *  possible but practically impossible for consecutive tests). */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

/** Waits for the child to exit, resolving its code (or 'timeout'). */
function waitExit(proc, timeoutMs = 5000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs)
    proc.once('exit', code => {
      clearTimeout(timer)
      resolve(code)
    })
  })
}

/**
 * A fake scsynth: listens on a UDP port and answers the two replies the
 * project waits for (/done after /d_load, /synced after /sync), so the
 * server reaches "ready" without any real audio device.
 */
function startFakeScsynth() {
  const socket = dgram.createSocket('udp4')
  socket.on('message', (message, remote) => {
    const end = message.indexOf(0)
    if (end <= 0) return
    const address = message.toString('utf8', 0, end)
    if (address === '/d_load') {
      socket.send(Buffer.from('/done\x00\x00\x00\x00'), remote.port, remote.address)
    } else if (address === '/sync') {
      socket.send(Buffer.from('/synced\x00\x00\x00\x00\x00\x00'), remote.port, remote.address)
    }
  })
  return new Promise(resolve => {
    socket.bind(0, '127.0.0.1', () => {
      resolve({
        port: socket.address().port,
        close: () =>
          new Promise(done => {
            try {
              socket.close(() => done())
            } catch {
              done()
            }
          }),
      })
    })
  })
}

/** Boots the server with a fake scsynth and no audio device.
 *  Returns { base, monitorBase, proc, stop }. */
async function startServer() {
  const fakeScsynth = await startFakeScsynth()
  const performerPort = await freePort()
  const monitorPort = await freePort()
  const proc = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server.js')], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PNDS_AUDIO_OUTPUT_BUS: '8',
      PNDS_AUDIO_OUTPUT_CHANNELS: '16',
      PNDS_OSC_TARGET: `127.0.0.1:${fakeScsynth.port}`,
      PNDS_PERFORMER_PORT: String(performerPort),
      PNDS_MONITOR_PORT: String(monitorPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const base = `http://127.0.0.1:${performerPort}`
  const monitorBase = `http://127.0.0.1:${monitorPort}`
  return {
    base,
    monitorBase,
    proc,
    async stop() {
      proc.kill('SIGTERM')
      const code = await waitExit(proc)
      if (code === 'timeout') proc.kill('SIGKILL')
      await fakeScsynth.close()
      return code
    },
  }
}

function fetchJson(url, options) {
  return fetch(url, options).then(async response => {
    const body = await response.json().catch(() => null)
    return { status: response.status, body }
  })
}

async function waitForHealth(base, expectedStatus, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const { status, body } = await fetchJson(`${base}/__pnds/health`, { signal: AbortSignal.timeout(500) })
      if (status === 200 && body?.status === expectedStatus) return body
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`health never became ${expectedStatus}`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('performer health reports ready with the runtime contract payload', async () => {
  const server = await startServer()
  try {
    const health = await waitForHealth(server.base, 'ready')
    assert.equal(health.projectId, 'multichannel-signal-generator')
    assert.equal(health.audioMode, 'internal')
    assert.equal(health.audio.status, 'ready')
    assert.match(health.audio.target, /^127\.0\.0\.1:\d+$/)
    assert.equal(health.scoreServer.performerPort, Number(new URL(server.base).port))
    assert.equal(health.scoreServer.monitorPort, Number(new URL(server.monitorBase).port))
  } finally {
    await server.stop()
  }
})

test('performer / is a no-UI stub, monitor serves the fader page', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')

    const performerPage = await fetch(`${server.base}/`)
    assert.equal(performerPage.status, 200)
    const performerHtml = await performerPage.text()
    assert.match(performerHtml, /control-client\.js/)

    const monitorPage = await fetch(`${server.monitorBase}/`)
    assert.equal(monitorPage.status, 200)
    assert.match(monitorPage.headers.get('content-type'), /text\/html/)
    const monitorHtml = await monitorPage.text()
    assert.match(monitorHtml, /Multichannel Signal Generator/)
    assert.match(monitorHtml, /16-ch sine wave test/)
    assert.match(monitorHtml, /16 test-tone toggles/i)

    // The QR row copy points at the monitor page (not the performer stub).
    assert.match(monitorHtml, /control-client\.js/)
  } finally {
    await server.stop()
  }
})

test('both control pages serve the same theme-follow module', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')

    // The monitor page loads the theme-bridge module (spec §5.3) from
    // the App-contract namespace…
    const monitorPage = await fetch(`${server.monitorBase}/`)
    const monitorHtml = await monitorPage.text()
    assert.match(monitorHtml, /\/__pnds\/theme-follow\.js/)

    const themeModule = await fetch(`${server.monitorBase}/__pnds/theme-follow.js`)
    assert.equal(themeModule.status, 200)
    assert.match(themeModule.headers.get('content-type'), /text\/javascript/)
    assert.match(await themeModule.text(), /pnds:theme/)

    // …while the performer port keeps its health-only surface.
    const performerThemeModule = await fetch(`${server.base}/__pnds/theme-follow.js`)
    assert.equal(performerThemeModule.status, 200)
  } finally {
    await server.stop()
  }
})

test('both control pages serve the locale-follow module and copy table', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')

    // The monitor page loads the locale-bridge module (network
    // reference "Locale Following") plus the bilingual copy table…
    const monitorPage = await fetch(`${server.monitorBase}/`)
    const monitorHtml = await monitorPage.text()
    assert.match(monitorHtml, /\/__pnds\/locale-follow\.js/)
    assert.match(monitorHtml, /src="\.\/copy\.js"/)

    const localeModule = await fetch(`${server.monitorBase}/__pnds/locale-follow.js`)
    assert.equal(localeModule.status, 200)
    assert.match(localeModule.headers.get('content-type'), /text\/javascript/)
    assert.match(await localeModule.text(), /pnds:locale/)

    const copyModule = await fetch(`${server.monitorBase}/copy.js`)
    assert.equal(copyModule.status, 200)
    assert.match(copyModule.headers.get('content-type'), /text\/javascript/)
    assert.match(await copyModule.text(), /zh-CN/)

    // …while the performer port keeps its health-only surface.
    const performerLocaleModule = await fetch(`${server.base}/__pnds/locale-follow.js`)
    assert.equal(performerLocaleModule.status, 200)
  } finally {
    await server.stop()
  }
})

test('project QR routes are retired on both ports', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')

    const qr = await fetch(`${server.monitorBase}/qr`)
    assert.equal(qr.status, 404)

    // PNG magic: 89 50 4E 47


    // The QR endpoint is monitor-only; the performer port does not expose it.
    const performerQr = await fetch(`${server.base}/qr`)
    assert.equal(performerQr.status, 404)
  } finally {
    await server.stop()
  }
})

test('tone API rejects out-of-range input and accepts valid input', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')

    const bad = await fetchJson(`${server.monitorBase}/api/tone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 17, on: true }),
    })
    assert.equal(bad.status, 400)
    assert.match(bad.body.error, /1\.\.16/)

    const badJson = await fetchJson(`${server.monitorBase}/api/tone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{oops',
    })
    assert.equal(badJson.status, 400)

    const okOn = await fetchJson(`${server.monitorBase}/api/tone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 4, on: true }),
    })
    assert.equal(okOn.status, 200)
    assert.equal(okOn.body.ok, true)
    assert.equal(okOn.body.state.tones[3].on, true)

    const okOff = await fetchJson(`${server.monitorBase}/api/tone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 4, on: false }),
    })
    assert.equal(okOff.status, 200)
    assert.equal(okOff.body.ok, true)
    assert.equal(okOff.body.state.tones[3].on, false)
  } finally {
    await server.stop()
  }
})

test('master API rejects out-of-range and accepts valid input', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')

    const bad = await fetchJson(`${server.monitorBase}/api/master`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 1.5 }),
    })
    assert.equal(bad.status, 400)
    assert.match(bad.body.error, /0\.\.1/)

    const ok = await fetchJson(`${server.monitorBase}/api/master`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 0.5 }),
    })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.ok, true)
    assert.equal(ok.body.state.masterValue, 0.5)
  } finally {
    await server.stop()
  }
})

test('SIGTERM shuts down both HTTP servers and exits cleanly', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')
    const code = await server.stop()
    assert.equal(code, 0, 'server should exit 0 after SIGTERM')

    // Ports released: a fresh listen must succeed.
    for (const port of [new URL(server.base).port, new URL(server.monitorBase).port]) {
      await new Promise((resolve, reject) => {
        const listener = net.createServer()
        listener.listen(Number(port), '127.0.0.1', () => {
          listener.close(() => resolve())
        })
        listener.on('error', reject)
      })
    }
  } finally {
    await server.stop()
  }
})

test('phone and monitor control one server state and preserve it on a fresh page read', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')
    const initial = await fetchJson(`${server.base}/api/state`)
    const tone = await fetchJson(`${server.base}/api/tone`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 16, on: true }),
    })
    assert.equal(tone.body.state.tones[15].on, true)
    const local = await fetchJson(`${server.monitorBase}/api/state`)
    assert.deepEqual(local.body, tone.body.state)
    const master = await fetchJson(`${server.monitorBase}/api/master`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 0.7 }),
    })
    const phone = await fetchJson(`${server.base}/api/state`)
    assert.deepEqual(phone.body, master.body.state)
    assert.equal(phone.body.masterValue, 0.7)
    assert.equal(phone.body.tones.length, 16)
    assert.equal(phone.body.runId, initial.body.runId)
    assert.equal(phone.body.revision, initial.body.revision + 2)
    assert.equal(phone.body.tones.filter(tone => tone.on).length, 1)
    assert.match(await (await fetch(`${server.base}/control-client.js`)).text(), /server-authoritative/)
    assert.equal((await fetch(`${server.base}/qr`)).status, 404)
  } finally { await server.stop() }
})

test('a delayed phone master acknowledgement converges to the monitor HTTP state', { timeout: 5000 }, async () => {
  const server = await startServer()
  const states = []
  const timers = new Map()
  let nextTimer = 0, releaseReply, acknowledgeWrite, ready, converge
  const heldReply = new Promise(resolve => { releaseReply = resolve })
  const writeReachedServer = new Promise(resolve => { acknowledgeWrite = resolve })
  const initialized = new Promise(resolve => { ready = resolve })
  const converged = new Promise(resolve => { converge = resolve })
  const controls = createControls({
    async fetch(url, options) {
      const response = await fetch(`${server.base}${url}`, options)
      if (url === '/api/master') {
        acknowledgeWrite()
        await heldReply
      }
      return response
    },
    schedule(callback, delay) {
      const id = ++nextTimer
      timers.set(id, { callback, delay })
      return id
    },
    cancel: id => timers.delete(id),
    onState(state) {
      states.push(state)
      ready()
      if (state.masterValue === 0.8) converge()
    },
    onError: error => assert.fail(error),
  })
  try {
    await waitForHealth(server.base, 'ready')
    controls.start()
    await initialized
    const write = controls.setMaster(0.2)
    await writeReachedServer
    const remote = await fetchJson(`${server.monitorBase}/api/master`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 0.8 }),
    })
    assert.equal(remote.status, 200)
    releaseReply()
    await write
    const poll = [...timers].find(([, timer]) => timer.delay === 250)
    assert.ok(poll, 'the next authoritative state read is scheduled')
    timers.delete(poll[0])
    poll[1].callback()
    await converged

    assert.equal(states.at(-1).masterValue, 0.8)
    assert.deepEqual(states.at(-1), remote.body.state)
    assert.deepEqual((await fetchJson(`${server.base}/api/state`)).body, remote.body.state)
  } finally {
    releaseReply()
    controls.stop()
    await server.stop()
  }
})

test('direct pages retain standalone context and relative queried resources', async () => {
  const server = await startServer()
  try {
    await waitForHealth(server.base, 'ready')
    for (const base of [server.base, server.monitorBase]) {
      const context = await fetch(`${base}/__pnds/context.js`)
      assert.equal(context.status, 200)
      assert.match(context.headers.get('content-type'), /javascript/)
      assert.match(await context.text(), /no Host confirmation/)
      const page = await fetch(base).then(response => response.text())
      const scripts = [...page.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1])
      assert.equal(scripts[0], './__pnds/context.js')
      assert.ok(scripts.every(script => script.startsWith('./')), scripts.join(', '))
      for (const script of scripts) {
        assert.equal((await fetch(new URL(`${script}?test=queried`, `${base}/`))).status, 200)
      }
    }
  } finally { await server.stop() }
})

test('confirmed control traffic stays under its immutable prefix and shares the monitor engine', async () => {
  const server = await startServer()
  const requests = []
  const prefix = '/__pnds/run/exact-confirmation/'
  const proxy = require('node:http').createServer(async (request, response) => {
    requests.push(request.url)
    if (!request.url.startsWith(prefix)) { response.writeHead(403).end(); return }
    const upstream = require('node:http').request(new URL(request.url.slice(prefix.length), `${server.base}/`), {
      method: request.method, headers: request.headers,
    }, result => { response.writeHead(result.statusCode, result.headers); result.pipe(response) })
    request.pipe(upstream)
    upstream.on('error', () => response.writeHead(502).end())
  })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
  const confirmedBase = `http://127.0.0.1:${proxy.address().port}${prefix}`
  let resolveState
  const received = new Promise(resolve => { resolveState = resolve })
  const errors = []
  const controls = createControls({
    participation: { resource: relative => new URL(relative, confirmedBase).href },
    fetch: (...args) => fetch(...args),
    onState: resolveState, onError: error => errors.push(error),
  })
  try {
    await waitForHealth(server.base, 'ready')
    controls.start()
    await Promise.race([received, new Promise((_, reject) => setTimeout(() => reject(new Error('confirmed state never arrived')), 1000))])
    assert.equal(await controls.setTone(16, true), true)
    assert.equal(await controls.setMaster(0.4), true)
    assert.equal(await controls.setChannel(16, 0.3), true)
    const state = (await fetchJson(`${server.monitorBase}/api/state`)).body
    assert.equal(state.tones[15].on, true)
    assert.equal(state.masterValue, 0.4)
    assert.equal(state.tones[15].volume, 0.3)
    assert.deepEqual(errors, [])
    assert.deepEqual(requests.slice(0, 4), [`${prefix}api/state`, `${prefix}api/tone`, `${prefix}api/master`, `${prefix}api/channel`])
  } finally {
    controls.stop()
    proxy.closeAllConnections()
    await new Promise(resolve => proxy.close(resolve))
    await server.stop()
  }
})

test('App-owned listeners report their actual ports and preserve the shared control engine', async () => {
  const fake = await startFakeScsynth()
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'msg-runtime-'))
  const listeners = await Promise.all(['performer', 'monitor'].map(async role => {
    const listener = net.createServer()
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
    return { listener, role, port: listener.address().port }
  }))
  const assignment = {
    version: 1, runId: 'msg-listener-owner', reportPath: path.join(directory, 'bound.json'),
    services: listeners.map(({ role, port }, index) => ({ role, port, fd: index + 3 })),
  }
  const proc = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server.js')], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PNDS_OSC_TARGET: `127.0.0.1:${fake.port}`, PNDS_RUNTIME_PORTS: JSON.stringify(assignment), PNDS_PERFORMER_PORT: '1', PNDS_MONITOR_PORT: '2' },
    stdio: ['ignore', 'pipe', 'pipe', ...listeners.map(({listener}) => listener._handle.fd)],
  })
  await Promise.all(listeners.map(({ listener }) => new Promise(resolve => listener.close(resolve))))
  try {
    const base = `http://127.0.0.1:${listeners[0].port}`
    const monitor = `http://127.0.0.1:${listeners[1].port}`
    const health = await waitForHealth(base, 'ready', 1500)
    assert.equal(health.scoreServer.runtimeRunId, assignment.runId)
    assert.equal(health.scoreServer.performerPort, listeners[0].port)
    assert.equal(health.scoreServer.monitorPort, listeners[1].port)
    assert.deepEqual(JSON.parse(fs.readFileSync(assignment.reportPath, 'utf8')), {
      version: 1, runId: assignment.runId, status: 'bound',
      services: listeners.map(({role,port}) => ({role,port})),
    })
    const tone = await fetchJson(`${base}/api/tone`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({channel: 3, on: true}) })
    assert.deepEqual((await fetchJson(`${monitor}/api/state`)).body, tone.body.state)
  } finally {
    proc.kill('SIGTERM')
    if (await waitExit(proc) === 'timeout') proc.kill('SIGKILL')
    await fake.close()
    for (const file of [assignment.reportPath, `${assignment.reportPath}.tmp`]) fs.rmSync(file, { force: true })
    fs.rmdirSync(directory)
  }
})

test('per-channel volume is authoritative across both pages and composes with master without restarting tones', async () => {
  const server = await startServer()
  const post = (base, endpoint, body) => fetchJson(`${base}/api/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  try {
    await waitForHealth(server.base, 'ready')
    const initial = (await fetchJson(`${server.base}/api/state`)).body
    assert.equal((await post(server.base, 'channel', {channel: 5, value: 2})).status, 400)
    const channel = await post(server.base, 'channel', {channel: 5, value: 0.5})
    assert.equal(channel.status, 200)
    assert.equal(channel.body.state.tones[4].volume, 0.5)
    await post(server.monitorBase, 'tone', {channel: 5, on: true})
    const master = await post(server.monitorBase, 'master', {value: 0.8})
    const state = (await fetchJson(`${server.base}/api/state`)).body
    assert.deepEqual(state, master.body.state)
    assert.equal(state.runId, initial.runId)
    assert.equal(state.tones[4].volume, 0.5)
    assert.ok(Math.abs(state.tones[4].gain - 0.251188643150958 * 0.03162277660168379) < 1e-12)
    assert.equal(state.tones[3].gain, 0)
    assert.equal((await post(server.base, 'tone', {channel: 5, on: false})).body.state.tones[4].gain, 0)
    assert.equal((await post(server.monitorBase, 'tone', {channel: 5, on: true})).body.state.tones[4].volume, 0.5)
  } finally { await server.stop() }
})
