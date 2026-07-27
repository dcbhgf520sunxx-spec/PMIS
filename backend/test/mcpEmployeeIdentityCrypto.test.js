const assert = require('node:assert/strict')
const test = require('node:test')

const {
  decryptEmployeeIdentity,
  encryptEmployeeIdentity,
} = require('../src/services/mcpEmployeeIdentityCrypto')

test('employee identity ciphertext round-trips and hides the employee number', () => {
  const encrypted = encryptEmployeeIdentity('005829', 'fixed-token', { now: 1_722_000_000_000 })

  assert.equal(encrypted.includes('005829'), false)
  assert.equal(decryptEmployeeIdentity(encrypted, 'fixed-token', {
    now: 1_722_000_030_000,
  }), '005829')
})

test('employee identity ciphertext is non-deterministic', () => {
  const first = encryptEmployeeIdentity('005829', 'fixed-token')
  const second = encryptEmployeeIdentity('005829', 'fixed-token')

  assert.notEqual(first, second)
})
