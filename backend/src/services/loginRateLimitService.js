const WINDOW_MS = 15 * 60 * 1000
const REQUEST_WINDOW_MS = 60 * 1000
const MAX_ENTRIES = 5000
const MAX_FAILURES = 5

function createLoginRateLimitService({ now = Date.now } = {}) {
  // shortcut: 与当前单实例部署一致；多实例前须迁至共享存储并原子预留。
  const accounts = new Map()
  const unknownAccounts = new Map()
  const requests = new Map()
  let nextCleanupAt = 0

  function refresh(state, time) {
    if (state.lockedUntil && state.lockedUntil <= time) {
      state.failures = []
      state.lockedUntil = 0
    }
    state.failures = state.failures.filter(at => at > time - WINDOW_MS)
  }

  function cleanup(time) {
    if (time < nextCleanupAt && accounts.size < MAX_ENTRIES && unknownAccounts.size < MAX_ENTRIES && requests.size < MAX_ENTRIES) return
    for (const store of [accounts, unknownAccounts]) {
      for (const [key, state] of store) {
        refresh(state, time)
        if (!state.pending && !state.failures.length && !state.lockedUntil) store.delete(key)
      }
    }
    for (const [key, state] of requests) {
      if (state.expiresAt <= time) requests.delete(key)
    }
    nextCleanupAt = time + 10000
  }

  function takeRequest(clientIp) {
    const time = now()
    cleanup(time)
    let state = requests.get(clientIp)
    if (!state || state.expiresAt <= time) {
      if (!state && requests.size >= MAX_ENTRIES) return 60
      state = { count: 0, expiresAt: time + REQUEST_WINDOW_MS }
      requests.set(clientIp, state)
    }
    if (state.count >= 120) return Math.max(1, Math.ceil((state.expiresAt - time) / 1000))
    state.count++
    return 0
  }

  function begin(accountKey, { knownAccount = true } = {}) {
    const time = now()
    cleanup(time)
    // 虚假账号的容量独立，避免任意输入挤占真实账号的登录保护。
    const store = knownAccount ? accounts : unknownAccounts
    let state = store.get(accountKey)
    if (!state) {
      if (store.size >= MAX_ENTRIES) return { retryAfter: 60, reason: 'capacity' }
      state = { failures: [], pending: 0, lockedUntil: 0 }
      store.set(accountKey, state)
    }
    refresh(state, time)
    if (state.lockedUntil > time) return { retryAfter: Math.ceil((state.lockedUntil - time) / 1000), reason: 'locked' }
    if (state.failures.length + state.pending >= MAX_FAILURES) return { retryAfter: 1, reason: 'pending' }
    state.pending++
    let completed = false
    return {
      retryAfter: 0,
      complete(outcome) {
        if (completed) return
        completed = true
        state.pending--
        const finishedAt = now()
        refresh(state, finishedAt)
        if (outcome === 'success') {
          state.failures = []
          state.lockedUntil = 0
        } else if (outcome === 'failure') {
          state.failures.push(finishedAt)
          if (state.failures.length >= MAX_FAILURES && !state.lockedUntil) state.lockedUntil = finishedAt + WINDOW_MS
        }
        if (!state.pending && !state.failures.length && !state.lockedUntil) store.delete(accountKey)
      }
    }
  }

  return { takeRequest, begin }
}

module.exports = { createLoginRateLimitService }
