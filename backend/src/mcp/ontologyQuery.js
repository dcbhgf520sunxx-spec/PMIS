const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { mkdtemp, writeFile, rm, access } = require('node:fs/promises')
const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')
const { pathToFileURL } = require('node:url')
const { invokeController } = require('./controllerAdapter')
const { normalizeMcpQueryContent } = require('./contentPolicy')
const exec = promisify(execFile)
const packagedRoot = resolve(__dirname, '../../ontology/standard')
const root = process.env.SIDM_ONTOLOGY_ROOT || (existsSync(packagedRoot)
  ? packagedRoot : resolve(__dirname, '../../../artifacts/sidm-ontology/standard'))
const requiredMenus = ['/products', '/projects', '/requirements', '/tasks', '/bugs', '/work-orders']
const definition = {
  name: 'sidm_standard_ontology_query',
  title: '标准本体业务关系查询',
  description: '按产品ID和可选项目ID执行标准OWL/HermiT、SHACL与SPARQL。仅传产品ID查询需求来源、运维合同和工单；项目工作与登记付款必须另传项目ID，未传项目时相关空数组不表示没有工作或付款。每条答案附validationStatus和validationIssues；异常待核实不得表述为已核对结论。读取完整产品范围，需要六类业务模块权限。',
  inputSchema: { type: 'object', properties: { product_id: {type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER,description:'产品标识；先用product_search定位'}, project_id:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER,description:'可选项目标识，必须属于所选产品'} }, required:['product_id'],additionalProperties:false },
  outputSchema: {type:'object',required:['execution','validation','reasoning','issues','answers','objects','limitations'],description:'标准本体执行证据、逐条校验状态、业务答案与范围限制；异常结果不得当作已核对结论',properties:{execution:{type:'object'},validation:{type:'object'},reasoning:{type:'object'},issues:{type:'array',items:{type:'object'}},answers:{type:'object'},objects:{type:'object'},limitations:{type:'array',items:{type:'string'}}},additionalProperties:false},
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
  _meta:{endpointType:'query',menuPath:'/products',permissionCode:null},
}
function assertPermission(context) {
  if (!requiredMenus.every(menu => context.allowedMenuPaths?.has(menu))) {
    const error = new Error('本体查询需要产品、项目、需求、任务、BUG和工单查询权限')
    error.code = 'MCP_PERMISSION_DENIED'
    throw error
  }
}
function controllerFor(path) {
  const lists = {products:'productController',requirements:'requirementController',projects:'projectController',tasks:'taskController',bugs:'bugController','work-orders':'workOrderController'}
  let match = /^\/api\/(products|requirements|projects|tasks|bugs|work-orders)(?:\/(\d+))?$/.exec(path)
  if (match) return [require(`../controllers/${lists[match[1]]}`)[match[2]?'getById':'list'],{id:match[2]}]
  match = /^\/api\/products\/(\d+)\/maintenance-contracts$/.exec(path)
  if (match) return [require('../controllers/productMaintenanceContractController').list,{id:match[1]}]
  match = /^\/api\/projects\/(\d+)\/(stage-plan|contract)(?:\/stages\/(\d+)\/payments)?$/.exec(path)
  if (match) return match[3]
    ? [require('../controllers/projectContractController').listPayments,{id:match[1],stageId:match[3]}]
    : match[2]==='stage-plan'
      ? [require('../controllers/projectStagePlanController').getPlan,{projectId:match[1]}]
      : [require('../controllers/projectContractController').getByProject,{id:match[1]}]
  throw new Error('不支持的本体读取路径')
}
async function queryOntology(args,context) {
  assertPermission(context)
  const python = process.env.SIDM_ONTOLOGY_PYTHON || join(root,'.venv/bin/python')
  try { await access(python); await access(join(root,'sidm.ttl')) } catch {
    const error = new Error('标准本体运行环境未安装，请按本体接入说明准备Python与Java')
    error.code = 'MCP_ONTOLOGY_UNAVAILABLE'; throw error
  }
  let dir
  try {
    const {collect} = await import(pathToFileURL(resolve(root,'../read-chain.mjs')).href)
    const calls = []; const deadline = Date.now()+120000
    const get = async (path,params={}) => {
      assertPermission(context)
      if (Date.now()>deadline) throw new Error('本体读取超时')
      const [handler,routeParams] = controllerFor(path)
      const body = await invokeController(handler,context,{params:routeParams,query:params})
      if (body.code!==0) throw new Error('本体源数据读取失败')
      const data = normalizeMcpQueryContent(body.data,{summary:true})
      calls.push({path:path.replace(/^\/api/,''),params,at:new Date().toISOString(),...(Array.isArray(data)?{rows:data.length}:Array.isArray(data?.list)?{rows:data.list.length,total:data.total}:{})})
      return data
    }
    const environment = process.env.SIDM_ONTOLOGY_ENVIRONMENT || `http://127.0.0.1:${process.env.PORT || 3103}`
    const raw = await collect(get,environment,args.product_id,true,true,true)
    if (args.project_id!==undefined&&!raw.projects.some(p=>String(p.id)===String(args.project_id))) {
      const error = new Error('项目不属于所选产品');error.code='MCP_ARGUMENT_INVALID';error.fieldErrors={project_id:error.message};throw error
    }
    raw.calls=calls;raw.sourceTransport='authorized-controller'
    dir=await mkdtemp(join(tmpdir(),'sidm-query-ontology-'))
    const capture=join(dir,'capture.json');await writeFile(capture,JSON.stringify(raw),{mode:0o600})
    const {stdout}=await exec(python,[join(root,'answer.py'),capture,String(args.product_id),String(args.project_id||0),dir],{timeout:120000,maxBuffer:4*1024*1024})
    const result=JSON.parse(stdout)
    result.execution.requestId=context.auditRequestId || context.requestId
    result.execution.entrypoint='SIDM Query MCP'
    return result
  } catch (error) {
    if (error.code?.startsWith('MCP_')) throw error
    const failure=new Error('标准本体执行失败；未返回部分答案，请使用请求编号检查运行环境或数据校验')
    failure.code='MCP_ONTOLOGY_QUERY_FAILED';throw failure
  } finally {if(dir)await rm(dir,{recursive:true,force:true})}
}
module.exports={definition,requiredMenus,assertPermission,queryOntology}
