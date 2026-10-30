'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { create } = require('../public/control-client')
const flush = () => new Promise(resolve => setImmediate(resolve))
const state = (revision, masterValue = 0.9, runId = 'run-a') => ({ runId, revision, masterValue, outputChannels: 16, tones: [{ channel: 1, on: revision > 0, gain: 0.5 }] })

function harness() {
  const requests = [], states = [], errors = [], timers = new Map()
  let nextTimer = 0
  const client = create({
    fetch(url, options) {
      return new Promise(resolve => requests.push({ url, options, reply: payload => resolve({ ok: true, json: async () => payload }) }))
    },
    schedule(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    cancel(id) { timers.delete(id) },
    onState: value => states.push(value), onError: error => errors.push(error),
  })
  return { client, requests, states, errors, poll() {
    const timer = [...timers].find(([, timer]) => timer.delay === 250)
    assert.ok(timer, 'a bounded next poll is scheduled')
    timers.delete(timer[0]); timer[1].callback()
  } }
}

test('joining restores server tones/master without sending initialization commands', async () => {
  const h = harness(); h.client.start()
  h.requests[0].reply(state(8, 0.4))
  await flush()
  assert.equal(h.states[0].tones[0].on, true)
  assert.equal(h.states[0].masterValue, 0.4)
  assert.deepEqual(h.requests.map(request => request.url), ['/api/state'])
  h.client.stop()
})

test('polls cannot overwrite newer writes and server revisions cannot move backwards', async () => {
  const h = harness(); h.client.start(); h.requests[0].reply(state(0)); await flush()
  h.poll()
  const command = h.client.setTone(1, true); await flush()
  h.requests[1].reply(state(0)); await flush()
  assert.equal(h.states.length, 1)
  h.requests[2].reply({ ok: true, state: state(3) }); await command
  assert.equal(h.states.at(-1).revision, 3)
  h.poll(); h.requests[3].reply(state(1)); await flush()
  assert.equal(h.states.at(-1).revision, 3)
  h.client.stop()
})

test('rapid fader values coalesce while retaining the latest command and serial ordering', async () => {
  const h = harness(); h.client.start(); h.requests[0].reply(state(0)); await flush()
  const first = h.client.setMaster(0.2); await flush()
  const final = h.client.setMaster(0.5); h.client.setMaster(0.7)
  assert.equal(h.requests.length, 2)
  h.requests[1].reply({ ok: true, state: state(1, 0.2) }); await flush()
  assert.equal(JSON.parse(h.requests[2].options.body).value, 0.7)
  h.requests[2].reply({ ok: true, state: state(2, 0.7) })
  assert.equal(await first, true); assert.equal(await final, true)
  assert.equal(h.states.at(-1).masterValue, 0.7)
  h.client.stop()
})

test('stop aborts old requests and a new server run may start at revision zero', async () => {
  const h = harness(); h.client.start()
  h.client.stop()
  assert.equal(h.requests[0].options.signal.aborted, true)
  h.client.start(); h.requests[1].reply(state(0, 0.9, 'run-b')); await flush()
  h.requests[0].reply(state(100, 1, 'run-a')); await flush()
  assert.deepEqual(h.states.map(value => value.runId), ['run-b'])
  h.client.stop()
})

test('invalid state reports failure and a later poll can recover', async () => {
  const h = harness(); h.client.start(); h.requests[0].reply({ outputChannels: 16 }); await flush()
  assert.equal(h.errors.length, 1); assert.equal(h.states.length, 0)
  h.poll(); h.requests[1].reply(state(0)); await flush()
  assert.equal(h.states.length, 1)
  h.client.stop()
})
