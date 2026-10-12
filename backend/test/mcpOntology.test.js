const test = require('node:test')
const assert = require('node:assert/strict')
const { filterToolsForContext, getToolDefinition, resolvePublicTool } = require('../src/mcp/catalog')
const { validateToolArguments, validateToolPermission } = require('../src/mcp/dispatcher')
const menus = ['/products', '/projects', '/requirements', '/tasks', '/bugs', '/work-orders']
test('标准本体工具属于现有Query，Action不可发现或调用', () => {
  const tools = filterToolsForContext({ endpointType: 'query', allowedMenuPaths: new Set(menus) })
  assert.ok(tools.some(t => t.name === 'sidm_standard_ontology_query'))
  assert.equal(getToolDefinition('sidm_standard_ontology_query', 'action'), undefined)
  assert.deepEqual(resolvePublicTool('sidm_standard_ontology_query', {product_id: 74}, 'query'), {name:'sidm_standard_ontology_query',args:{product_id:74}})
})
test('少任一图谱来源模块权限就隐藏并拒绝本体查询', () => {
  const definition = getToolDefinition('sidm_standard_ontology_query', 'query')
  assert.ok(definition)
  for (const missing of menus) {
    const context = {endpointType:'query',allowedMenuPaths:new Set(menus.filter(m => m!==missing))}
    assert.equal(filterToolsForContext(context).some(t=>t.name===definition.name),false)
    assert.throws(()=>validateToolPermission(definition,{product_id:74},context), e=>e.code==='MCP_PERMISSION_DENIED')
  }
})
test('本体查询拒绝身份、路径、额外参数并支持可选项目', () => {
  const definition = getToolDefinition('sidm_standard_ontology_query', 'query')
  assert.ok(definition)
  assert.doesNotThrow(()=>validateToolArguments(definition,{product_id:74}))
  for (const args of [{product_id:0},{product_id:74,path:'/tmp/data'},{product_id:74,employee_no:'fake'}]) {
    assert.throws(()=>validateToolArguments(definition,args), e=>e.code==='MCP_ARGUMENT_INVALID')
  }
})
