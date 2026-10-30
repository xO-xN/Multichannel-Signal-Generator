// One server-authoritative control model for the phone and desktop pages.
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.PNDS_CONTROL = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'
  function create(options) {
    const fetcher = options.fetch || fetch
    const schedule = options.schedule || setTimeout
    const cancel = options.cancel || clearTimeout
    let active = false, epoch = 0, timer = null
    let queue = Promise.resolve(), mutation = 0
    let run = null, revision = -1
    let masterPending = null, masterTask = null
    const retiredRuns = new Set(), writes = new Set(), requests = new Set()

    function apply(state, owner) {
      if (!active || epoch !== owner) return
      if (!state || typeof state.runId !== 'string' || !Number.isSafeInteger(state.revision) || !Array.isArray(state.tones) || !Number.isFinite(state.masterValue)) throw new Error('Invalid control state')
      if (retiredRuns.has(state.runId)) return
      if (run !== state.runId) {
        if (run !== null) retiredRuns.add(run)
        if (retiredRuns.size > 8) retiredRuns.delete(retiredRuns.values().next().value)
        run = state.runId
        revision = -1
      }
      if (state.revision < revision) return
      revision = state.revision
      options.onState(state)
    }
    async function request(url, body, owner) {
      const controller = new AbortController()
      requests.add(controller)
      const timeout = schedule(() => controller.abort(), 3000)
      try {
        const response = await fetcher(url, { signal: controller.signal,
          ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        })
        if (!response.ok) throw new Error('Control request failed: ' + response.status)
        const payload = await response.json()
        return active && epoch === owner ? payload : null
      } finally { cancel(timeout); requests.delete(controller) }
    }
    async function refresh(owner) {
      const checkpoint = mutation
      try {
        const state = await request('/api/state', undefined, owner)
        if (checkpoint === mutation && writes.size === 0 && state) apply(state, owner)
      } catch (error) { if (active && epoch === owner) options.onError(error) }
    }
    function enqueue(action) {
      const owner = epoch, token = {}
      mutation++
      writes.add(token)
      const task = queue.then(async () => {
        if (!active || epoch !== owner) return false
        try { await action(owner); return true }
        catch (error) { if (active && epoch === owner) options.onError(error); return false }
      }).finally(() => writes.delete(token))
      queue = task
      return task
    }
    async function post(url, body, owner) {
      const payload = await request(url, body, owner)
      if (payload) apply(payload.state, owner)
    }
    function start() {
      if (active) return
      active = true
      const owner = ++epoch
      async function poll() {
        if (!active || owner !== epoch) return
        if (writes.size === 0) await refresh(owner)
        if (active && owner === epoch) timer = schedule(poll, 250)
      }
      void poll()
    }
    function stop() {
      active = false; epoch++
      cancel(timer)
      requests.forEach(controller => controller.abort())
      requests.clear(); writes.clear()
      masterPending = null; masterTask = null; queue = Promise.resolve()
    }
    return {
      start, stop,
      setTone(channel, on) {
        if (!active) return Promise.resolve(false)
        return enqueue(owner => post('/api/tone', { channel, on }, owner))
      },
      setMaster(value) {
        if (!active) return Promise.resolve(false)
        masterPending = value
        if (masterTask) return masterTask
        const task = enqueue(async owner => {
          while (active && owner === epoch && masterPending !== null) {
            const next = masterPending; masterPending = null
            await post('/api/master', { value: next }, owner)
          }
        }).finally(() => { if (masterTask === task) masterTask = null })
        masterTask = task
        return task
      },
    }
  }
  return { create }
})
