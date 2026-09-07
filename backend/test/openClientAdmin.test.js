const test = require('node:test')
const assert = require('node:assert/strict')

test('接入管理仅填写名称和有效期，拒绝篡改身份、编码及旧授权配置', () => {
  const { validateClientConfig } = require('../src/services/openClientAdminService')
  const valid = {name:'测试系统',expiresAt:null}
  assert.deepEqual(validateClientConfig(valid),valid)
  for (const bad of [{...valid,code:'manual'},{...valid,creator_id:2},{...valid,name:' '},{...valid,scopes:[]},{...valid,operatorIds:[]},{...valid,expiresAt:'2020-01-01'}]) {
    assert.throws(() => validateClientConfig(bad))
  }
})
