const assert = require('node:assert/strict')
const test = require('node:test')
const { buildViewQuery, calculateViewCounts } = require('../src/utils/viewCounts')

test('单个视图查询按配置排除冲突条件并追加范围', () => {
  assert.deepEqual(buildViewQuery(
    { status: 1, follower_id: 5 },
    { omitFilters: ['follower_id'], scope: { follower_id: 7 } }
  ), { status: 1, follower_id: 7 })
})

test('视图统计组合公共查询条件和各视图范围', async () => {
  const received = []
  const filters = { status: 1, filter_follower_id: 5 }

  const result = await calculateViewCounts({
    filters,
    views: {
      all: {},
      mine: {
        omitFilters: ['filter_follower_id'],
        scope: { follower_id: 7 }
      }
    },
    count: async (query) => {
      received.push(query)
      return query.follower_id === 7 ? 3 : 11
    }
  })

  assert.deepEqual(result, { all: 11, mine: 3 })
  assert.deepEqual(received, [
    { status: 1, filter_follower_id: 5 },
    { status: 1, follower_id: 7 }
  ])
  assert.deepEqual(filters, { status: 1, filter_follower_id: 5 })
})
