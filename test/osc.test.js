// Fixed OSC wire fixtures, captured from the prior osc-min 1.1.2 reference.
// This project's encoder remains project-owned; tests need no external repository.
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { encodeMessage } = require('../lib/osc')

test('encodeMessage /d_load preserves its fixed OSC wire bytes', () => {
  assert.equal(encodeMessage("/d_load", ["/tmp/pnds-tone.scsyndef"]).toString('hex'), '2f645f6c6f6164002c7300002f746d702f706e64732d746f6e652e736373796e64656600')
})

test('encodeMessage /g_new preserves its fixed OSC wire bytes', () => {
  assert.equal(encodeMessage("/g_new", [1000,1,0]).toString('hex'), '2f675f6e657700002c66666600000000447a00003f80000000000000')
})

test('encodeMessage /s_new preserves its fixed OSC wire bytes', () => {
  assert.equal(encodeMessage("/s_new", ["toneTest",1001,1,1000,"freq",110,"gain",0,"out",16]).toString('hex'), '2f735f6e657700002c7366666673667366736600746f6e655465737400000000447a40003f800000447a0000667265710000000042dc00006761696e00000000000000006f75740041800000')
})

test('encodeMessage /n_set preserves its fixed OSC wire bytes', () => {
  assert.equal(encodeMessage("/n_set", [1001,"gain",0.5]).toString('hex'), '2f6e5f73657400002c66736600000000447a40006761696e000000003f000000')
})

test('encodeMessage /sync preserves its fixed OSC wire bytes', () => {
  assert.equal(encodeMessage("/sync", [1]).toString('hex'), '2f73796e630000002c6600003f800000')
})

test('encodeMessage /g_freeAll preserves its fixed OSC wire bytes', () => {
  assert.equal(encodeMessage("/g_freeAll", [1000]).toString('hex'), '2f675f66726565416c6c00002c660000447a0000')
})

test('encodeMessage rejects a non-slash address', () => {
  assert.throws(() => encodeMessage('n_set', []), /must start with '\/'/)
})
