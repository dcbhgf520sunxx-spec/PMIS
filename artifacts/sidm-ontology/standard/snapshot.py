"""Transport-field mapping only. Business constraints and answers live in OWL/SHACL/SPARQL.
Input is a host-provided authorized capture, never an MCP caller's argument.
"""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
M=json.loads((ROOT.parent/'mapping.json').read_text())

def map_snapshot(raw):
 if raw.get('kind')!='api-read' or not raw.get('environment') or not raw.get('capturedAt'):raise ValueError('缺少授权读取来源')
 env=raw['environment'];prefix='urn:sidm:data:'+hashlib.sha256(env.encode()).hexdigest()[:20]+':'
 def iri(t,i):
  if not re.fullmatch(r'[1-9]\d*',str(i)):raise ValueError('无效业务标识')
  return prefix+t+':'+str(i)
 entities={};edges=[];complete=[]
 def add(t,row,spec=None,endpoint=''):
  key=iri(t,row['id']);attrs={}
  for prop,field in (spec or {}).get('fields',{}).items():
   value=row.get(field)
   if value is None:continue
   enum=(spec or {}).get('enums',{}).get(prop)
   if enum:value=enum.get(str(value),str(value))
   attrs[prop]=value
  if t in ('Person','Supplier') and row.get('name'):attrs['name']=row['name']
  if key in entities:
   if t not in ('Person','Supplier'):raise ValueError('重复业务对象')
   old=entities[key]['attributes'].get('name')
   if old and attrs.get('name') and old!=attrs['name']:raise ValueError('读取期间名称变化')
   entities[key]['attributes'].update(attrs);return key
  entities[key]={'id':key,'type':t,'attributes':attrs,'source':{'recordId':str(row['id']),'environment':env,'capturedAt':raw['capturedAt'],'endpoint':endpoint}}
  return key
 def link(subject,prop,t,i):
  if i is not None:edges.append({'subject':subject,'relation':prop,'object':iri(t,i)})
 def person(subject,prop,i,name=None):
  if i is not None:link(subject,prop,'Person',i);add('Person',{'id':i,'name':name},endpoint='embedded-role')
 product=str(raw['productId'])
 if len(raw['products'])!=1 or str(raw['products'][0]['id'])!=product:raise ValueError('产品范围不符')
 for t,spec in M['types'].items():
  for row in raw[spec['collection']]:
   k=add(t,row,spec,spec['endpoint'])
   if t in ('Requirement','Project'):
    if str(row.get('product_id'))!=product:raise ValueError('产品范围不符')
    link(k,'belongsToProduct','Product',row['product_id'])
   if t in ('Product','Requirement','Project'):person(k,'owner',row.get('owner_id'),row.get('owner_name'))
   if t=='Project':
    link(k,'sourceRequirement','Requirement',row.get('requirement_id'))
    for p in row.get('members',[]):person(k,'member',p['id'],p.get('name'))
   if t=='Task':
    direct_parent(k,row,link)
    link(k,'parentTask','Task',row.get('parent_task_id'))
    for p in row.get('owners',[]):person(k,'taskOwner',p['id'],p.get('name'))
 for row in raw['delivery']['bugs']:
  k=add('Bug',row,M['delivery']['types']['Bug'],'/api/bugs');direct_parent(k,row,link);person(k,'assignee',row.get('assignee_id'),row.get('assignee_name'))
 projects={str(p['id']) for p in raw['projects']}
 plans=raw['delivery']['plans'];commerce=raw['commerce']
 for collection in (plans,commerce):
  ids=[str(p['projectId']) for p in collection]
  if len(ids)!=len(set(ids)) or set(ids)!=projects:raise ValueError('项目子集合读取不完整')
 for plan in plans:
  pid=str(plan['projectId'])
  if str(plan['project']['id'])!=pid:raise ValueError('阶段项目不符')
  for stage in plan['stages']:
   if str(stage['project_id'])!=pid:raise ValueError('阶段项目不符')
   k=add('ProjectStage',stage,M['delivery']['types']['ProjectStage'],f'/api/projects/{pid}/stage-plan');link(k,'stageProject','Project',pid)
   for item in stage['items']:
    if str(item['project_id'])!=pid or str(item['stage_id'])!=str(stage['id']):raise ValueError('事项归属不符')
    i=add('KeyItem',item,M['delivery']['types']['KeyItem'],f'/api/projects/{pid}/stage-plan');link(i,'itemStage','ProjectStage',stage['id']);person(i,'owner',item.get('owner_id'),item.get('owner_name'))
    for p in item.get('collaborators',[]):person(i,'collaborator',p['id'],p.get('name'))
 def read_proof(path,count=None):
  calls=[c for c in raw.get('calls',[]) if c.get('path')==path]
  return len(calls)==1 and (count is None or calls[0].get('rows')==count)
 for entry in commerce:
  pid=str(entry['projectId'])
  if 'contract' not in entry:raise ValueError('合同未读取')
  contract=entry['contract']
  if contract is None:
   if entry['payments']:raise ValueError('无合同却有付款')
   continue
  if str(contract['project_id'])!=pid:raise ValueError('合同归属不符')
  c=add('ProjectContract',contract,M['commerce']['types']['ProjectContract'],f'/api/projects/{pid}/contract');link(c,'contractProject','Project',pid)
  if contract.get('supplier_id') is not None:
   link(c,'supplier','Supplier',contract['supplier_id']);add('Supplier',{'id':contract['supplier_id'],'name':contract.get('supplier_name')},endpoint='embedded-supplier')
  stages=contract['stages'];payments=entry['payments'];stageids={str(s['id']) for s in stages};payids=[str(p['stageId']) for p in payments]
  if len(payids)!=len(set(payids)) or not set(payids)<=stageids:raise ValueError('付款分组归属不符')
  all_complete=set(payids)==stageids and read_proof(f'/projects/{pid}/contract')
  for stage in stages:
   if str(stage['contract_id'])!=str(contract['id']):raise ValueError('付款阶段合同不符')
   s=add('PaymentStage',stage,M['commerce']['types']['PaymentStage'],f'/api/projects/{pid}/contract');link(s,'stageContract','ProjectContract',contract['id'])
   group=next((p for p in payments if str(p['stageId'])==str(stage['id'])),None)
   records=group['records'] if group is not None else []
   path=f"/projects/{pid}/contract/stages/{stage['id']}/payments"
   covered=group is not None and read_proof(path,len(records))
   if covered:complete.append(s)
   all_complete=all_complete and covered
   for payment in records:
    if str(payment['stage_id'])!=str(stage['id']):raise ValueError('付款记录阶段不符')
    spec={'fields':{'amount':'payment_amount'}}
    p=add('PaymentRecord',payment,spec,'/api'+path)
    if payment.get('payment_month'):entities[p]['attributes']['paymentMonth']=payment['payment_month'][:7]
    link(p,'recordStage','PaymentStage',stage['id']);person(p,'handler',payment.get('handler_id'),payment.get('handler_name'))
  if all_complete:complete.append(c)
 operations=raw.get('operations')
 if operations is not None:
  if str(operations.get('productId'))!=product or not isinstance(operations.get('contracts'),list) or not isinstance(operations.get('workOrders'),list):raise ValueError('运维分支读取范围不完整')
  contracts=operations['contracts']
  for row in contracts:
   if str(row.get('product_id'))!=product:raise ValueError('运维合同产品归属不符')
   k=add('MaintenanceContract',row,M['operations']['types']['MaintenanceContract'],'/api/products/'+product+'/maintenance-contracts')
   link(k,'belongsToProduct','Product',product)
   if row.get('supplier_id') is not None:
    link(k,'supplier','Supplier',row['supplier_id']);add('Supplier',{'id':row['supplier_id'],'name':row.get('supplier_name')},endpoint='embedded-supplier')
  for row in contracts:
   if row.get('previous_contract_id') is not None:link(iri('MaintenanceContract',row['id']),'previousContract','MaintenanceContract',row['previous_contract_id'])
  for row in operations['workOrders']:
   if str(row.get('product_id'))!=product:raise ValueError('工单产品归属不符')
   k=add('WorkOrder',row,M['operations']['types']['WorkOrder'],'/api/work-orders')
   link(k,'belongsToProduct','Product',product)
   person(k,'follower',row.get('follower_id'),row.get('follower_name'))
 for edge in edges:
  if edge['object'] not in entities:raise ValueError('关系目标不在授权读取范围')
 return {'datasetKind':'api-read','entities':list(entities.values()),'relations':edges,'scope':{'productId':product,'environment':env,'sourceTransport':raw.get('sourceTransport'),'capturedAt':raw['capturedAt']},'consistency':'non-transactional-read'},complete

def direct_parent(k,row,link):
 p,r=row.get('project_id'),row.get('requirement_id')
 if (p is None)==(r is None) or row.get('source_type')!=(1 if p is not None else 2):raise ValueError('工作直接归属不明确')
 link(k,'belongsToProject' if p is not None else 'belongsToRequirement','Project' if p is not None else 'Requirement',p if p is not None else r)
