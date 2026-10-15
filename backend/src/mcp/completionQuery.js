const { TYPES } = require('../services/mcpCompletionAnalysisService')
const object = (properties,required=Object.keys(properties)) => ({type:'object',properties,required,additionalProperties:false})
const text = {type:'string'}
const count = {type:'integer',minimum:0}
const id = {type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}
const date = {type:'string',format:'date'}
const types = Object.keys(TYPES)
const period = object({preset:{type:'string',enum:['day','workday','week','month','quarter','year','custom']},
  start_date:date,end_date:date,anchor_date:date,offset:{type:'integer',minimum:-1000,maximum:1000}},['preset'])
for(const [field,description] of Object.entries({preset:'考核周期类型',start_date:'自定义考核开始日期',end_date:'自定义考核结束日期',anchor_date:'自然周期锚点日期',offset:'周期偏移量，默认0'}))period.properties[field]={...period.properties[field],description}
period.allOf=[{if:{properties:{preset:{const:'custom'}},required:['preset']},then:{required:['start_date','end_date'],properties:{anchor_date:false,offset:false}},else:{properties:{start_date:false,end_date:false}}}]
const result = object({person_id:id,person_name:text,business_type:{type:'string',enum:types},business_type_label:text,
  statistic_count:{type:['integer','null'],minimum:0},completed_count:{type:['integer','null'],minimum:0},
  known_statistic_count:count,known_completed_count:count,unknown_count:count,excluded_count:count,
  completion_rate:{type:['number','null'],minimum:0,maximum:100},result_status:{type:'string',enum:['不适用','待核实','已核实','无符合条件单据']}})
const detail=object({person_id:{type:['integer','null'],minimum:1},business_type:{type:'string',enum:types},record_id:id,name:text,
  plan_date:{type:['string','null'],format:'date'},parent_task_id:{type:['integer','null'],minimum:1},
  project_id:{type:['integer','null'],minimum:1},requirement_id:{type:['integer','null'],minimum:1},detail_target_id:{type:['integer','null'],minimum:1,description:'业务详情查询目标：阶段及关键事项传所属项目ID，其他类别传单据ID'},
  included:{type:['boolean','null']},completed:{type:['boolean','null']},period_basis:{type:['string','null']},reason_code:text,reason:text,
  evidence:{type:'array',items:object({source:text,date,log_id:{type:['integer','null'],minimum:1},record_id:id,business_type:{type:'string',enum:types},related_record_ids:{type:'array',items:id}},['source','date','log_id','record_id','business_type'])}})
const definition={name:'business_completion_analysis',title:'个人单据完成率查询',
  description:'按已确认个人完成率规则查询人员、单据类别和考核期。只计当前责任角色，最新计划日期归期，逾期遗留结转，主子任务按个人去重，取消关闭及上级关闭排除，暂停参与；BUG关闭算完成。历史结果采用业务日期和历史证据，证据不足数量或比例为null并标记待核实，不能当作0。项目阶段仅汇总事项且不推定个人归属。完整聚合独立于明细分页；续页须原样传datasetToken，无新权限或写入能力。',
  inputSchema:object({analysis_period:{...period,description:'考核期；支持自然日、周、月、季度、年或自定义，时区为上海；未结束按当天观察'},
    person_ids:{type:'array',minItems:1,maxItems:50,uniqueItems:true,items:id,description:'当前有效人员标识；省略则当前已鉴权用户，不借用被查询人员权限'},
    business_types:{type:'array',minItems:1,maxItems:7,uniqueItems:true,items:{type:'string',enum:types},description:'类别；stage_plan为关键事项，project_stage为项目阶段；项目阶段不计个人考核，省略查询当前账号有权限的类别'},
    page:{type:'integer',minimum:1,description:'明细页码，从1开始；统计结果始终使用完整集合'},page_size:{type:'integer',minimum:1,maximum:100,description:'明细每页条数，1至100，默认50'},
    dataset_token:{type:'string',pattern:'^[a-f0-9]{64}$',description:'明细续页原样传首次返回的datasetToken，数据变化须重新查询第一页'}},['analysis_period']),
  outputSchema:object({rule_version:text,period:object({preset:text,start_date:date,end_date:date}),observation_date:date,
    data_cutoff:{type:'string',format:'date-time'},results:{type:'array',items:result},
    details:object({items:{type:'array',items:detail},total:count,page:{type:'integer',minimum:1},pageSize:{type:'integer',minimum:1,maximum:100},totalPages:count,hasNextPage:{type:'boolean'},datasetToken:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
    coverage:object({statistics_complete:{type:'boolean'},stage_completion_complete:{type:'boolean'},authorized_business_types:{type:'array',items:{type:'string',enum:types}},notes:{type:'array',items:text}})}),
  annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true},_meta:{endpointType:'query',menuPath:null,permissionCode:null}}
definition.outputSchema.description='按人员和类别返回完成率与完整数量，明细分页及证据，无法核实的正式数量/比例为null并保留已知数量；不适用、待核实与无单据分别说明'
definition.inputSchema.allOf=[{if:{properties:{page:{minimum:2}},required:['page']},then:{required:['dataset_token']}}]
function assertPermission(args,context) {
  const requested=args.business_types||Object.keys(TYPES).filter(type=>context.allowedMenuPaths?.has(TYPES[type].menu))
  if(!requested.length||requested.some(type=>!context.allowedMenuPaths?.has(TYPES[type]?.menu)))throw Object.assign(new Error('当前账号没有所请求业务的完成率查询权限'),{code:'MCP_PERMISSION_DENIED'})
}
function scopeDefinition(tool,menus) {
  const businessTypes=tool.inputSchema.properties.business_types
  return {...tool,inputSchema:{...tool.inputSchema,properties:{...tool.inputSchema.properties,business_types:{...businessTypes,items:{...businessTypes.items,enum:types.filter(type=>menus.has(TYPES[type].menu))}}}}}
}
module.exports={definition,assertPermission,scopeDefinition}
