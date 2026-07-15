import type{RequirementRecord,RequirementStatus,RequirementType}from'./types';
export const requirementStatusLabels:Record<RequirementStatus,string>={0:'上会评估',1:'需求上会',2:'上会通过',3:'过会未通过',10:'提报评估',11:'需求审批',12:'审批通过',13:'审批未通过',20:'需求验证',21:'预研通过',22:'预研不通过',30:'需求整理',31:'实施中',32:'试运行',33:'已完成',34:'已完成未使用',35:'暂停'};
const t:Record<string,RequirementStatus[]>={'1_0':[1,35],'1_1':[2,3,35],'1_2':[30,35],'1_3':[0,35],'2_10':[11,35],'2_11':[12,13,35],'2_12':[30,35],'2_13':[10,35],'3_20':[21,22,35],'3_21':[30,35],'3_22':[35],'4_30':[31,35],'_30':[31,35],'_31':[32,35],'_32':[33,34,35],'_33':[34,35],'_34':[33,35]};
const pathStatuses:Record<RequirementType,RequirementStatus[]>={1:[0,1,2,3,30,31,32,33,34],2:[10,11,12,13,30,31,32,33,34],3:[20,21,22,30,31,32,33,34],4:[30,31,32,33,34]};
export function requirementStatusesForType(type?:RequirementType):RequirementStatus[]{return type?[...pathStatuses[type],35]:Object.keys(requirementStatusLabels).map(Number)as RequirementStatus[]}
export function normalizeRequirementStatusForType(type:RequirementType|undefined,status:RequirementStatus|undefined){return status===undefined||requirementStatusesForType(type).includes(status)?status:undefined}
export function allowedRequirementStatuses(r:Pick<RequirementRecord,'requirementType'|'status'>){if(r.status===35)return pathStatuses[r.requirementType];return t[`${r.requirementType}_${r.status}`]||t[`_${r.status}`]||[]}
export const requirementTypeLabels:Record<RequirementType,string>={1:'上会立项',2:'需求提报',3:'预研',4:'直接实施'};
