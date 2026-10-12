# -*- coding: utf-8 -*-
"""Execute the standard semantic pipeline on a host-authorized read capture."""
import argparse,hashlib,json
from datetime import datetime,timezone
from pathlib import Path
from rdflib import Graph,URIRef,Literal,RDF
from snapshot import map_snapshot
from import_graph import to_rdf,S
from reasoning import reason
from verify import validate_data
ROOT=Path(__file__).resolve().parent

def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');path.chmod(0o600)
def check_reads(raw):
 """Reject incomplete browser captures. Task total counts parent groups, not rows."""
 calls=raw.get('calls',[])
 def paged(path,filters,rows,grouped=False):
  cs=sorted([c for c in calls if c['path']==path and all(str(c['params'].get(k))==str(v) for k,v in filters.items())],key=lambda c:c['params']['page'])
  if not cs:raise ValueError('缺少列表读取证据')
  size=cs[0]['params']['pageSize'];total=cs[0]['total']
  count=len({str(r.get('parent_task_id') or r['id']) for r in rows}) if grouped else len(rows)
  pages=max(1,(total+size-1)//size)
  if len(cs)!=pages or [c['params']['page'] for c in cs]!=list(range(1,pages+1)) or any(c['total']!=total or c['params']['pageSize']!=size for c in cs) or sum(c['rows'] for c in cs)!=len(rows) or count!=total:raise ValueError('列表读取不完整或发生变化')
 def one(path):
  if sum(c['path']==path for c in calls)!=1:raise ValueError('缺少详情读取证据')
 one('/products/'+str(raw['productId']))
 for field in ('requirements','projects'):paged('/'+field,{'product_id':raw['productId']},raw[field])
 for field,key in (('requirements','requirement_id'),('projects','project_id')):
  for row in raw[field]:
   for name,rows in (('tasks',raw['tasks']),('bugs',raw['delivery']['bugs'])):
    paged('/'+name,{key:row['id']},[r for r in rows if str(r.get(key))==str(row['id'])],name=='tasks')
 for p in raw['projects']:
  for suffix in ('stage-plan','contract'):one(f"/projects/{p['id']}/{suffix}")
 if 'operations' in raw:
  path=f"/products/{raw['productId']}/maintenance-contracts"
  cs=[c for c in calls if c['path']==path]
  if len(cs)!=1 or cs[0].get('rows')!=len(raw['operations']['contracts']):raise ValueError('运维合同读取不完整')
  paged('/work-orders',{'product_id':raw['productId']},raw['operations']['workOrders'])

def annotate_answers(data,answers,issues):
 """Attach only relevant source-data issues; unrelated historical gaps stay separate."""
 for category,rows in answers.items():
  for row in rows:
   node=next((row[k] for k in ('contract','stage','requirement','work','workOrder') if k in row),None)
   scope={node} if node else set()
   if category in ('projectPayments','stagePayments') and node:
    contracts={URIRef(node)} if category=='projectPayments' else set(data.objects(URIRef(node),S.stageContract))
    scope.update(str(c) for c in contracts)
    stages={st for c in contracts for st in data.subjects(S.stageContract,c)}
    scope.update(str(st) for st in stages)
    scope.update(str(r) for st in stages for r in data.subjects(S.recordStage,st))
   elif category=='maintenanceContracts' and node:
    pending=[URIRef(node)];seen=set()
    while pending:
     n=pending.pop()
     if n in seen:continue
     seen.add(n);scope.add(str(n));pending.extend(data.objects(n,S.previousContract))
   elif category=='projectOpenWork' and node:
    n=URIRef(node);scope.update(str(p) for p in data.objects(n,S.parentTask));scope.update(str(c) for c in data.subjects(S.parentTask,n))
   elif category=='requirements' and row.get('project'):scope.add(row['project'])
   related=[i for i in issues if i['focus'] in scope]
   row['validationStatus']='异常待核实' if related else '通过已执行校验'
   row['validationIssues']=related
 return answers

def execute(source,product_id,project_id,output):
 raw=json.loads(Path(source).read_text());output=Path(output);output.mkdir(parents=True,exist_ok=True,mode=0o700);output.chmod(0o700)
 if raw.get('sourceTransport') not in ('browser-authorized-rest','authorized-rest','authorized-controller'):raise ValueError('当前执行器仅支持有读取记录的授权宿主只读采集格式')
 if str(raw['productId'])!=str(product_id) or (project_id and str(project_id) not in {str(p['id']) for p in raw['projects']}):raise ValueError('请求范围不符')
 check_reads(raw)
 mapped,complete=map_snapshot(raw);write(output/'mapped-assertions.json',mapped)
 data=to_rdf(output/'mapped-assertions.json')
 for uri in complete:data.add((URIRef(uri),S.paymentsComplete,Literal(True)))
 data.serialize(output/'asserted.ttl',format='turtle')
 validation=validate_data(data,output/'shacl');reasoning,inferred=reason(data,output/'hermit.log')
 if not reasoning['consistent'] or reasoning['unsatisfiableClasses']:raise ValueError('OWL存在矛盾，停止业务作答')
 inferred.serialize(output/'inferred.ttl',format='turtle')
 project=URIRef(next(e['id'] for e in mapped['entities'] if e['type']=='Project' and e['source']['recordId']==str(project_id))) if project_id else None
 def query(name):
  result=inferred.query((ROOT/'queries'/name).read_text());return [{str(k):str(v) for k,v in r.asdict().items()} for r in result]
 requirements=query('requirements.rq')
 work=query('open-work.rq')
 # Selecting ownership is also SPARQL, not a second handwritten business engine.
 owned={str(r[0]) for r in inferred.query('PREFIX s:<urn:sidm:ontology:> SELECT ?work WHERE { { ?work s:belongsToProject ?p } UNION { ?work s:itemStage/s:stageProject ?p } }',initBindings={'p':project})} if project else set()
 work=[r for r in work if r['work'] in owned]
 contracts={str(r[0]) for r in inferred.query('PREFIX s:<urn:sidm:ontology:> SELECT ?c WHERE { ?c s:contractProject ?p }',initBindings={'p':project})} if project else set()
 payments=[r for r in query('payments.rq') if r['contract'] in contracts]
 stages={str(r[0]) for r in inferred.query('PREFIX s:<urn:sidm:ontology:> SELECT ?s WHERE { ?s s:stageContract/s:contractProject ?p }',initBindings={'p':project})} if project else set()
 stage_payments=[r for r in query('stage-payments.rq') if r['stage'] in stages]
 maintenance=query('maintenance-contracts.rq') if 'operations' in raw else []
 orders=query('work-orders.rq') if 'operations' in raw else []
 product_node=next(e['id'] for e in mapped['entities'] if e['type']=='Product' and e['source']['recordId']==str(product_id))
 maintenance=[r for r in maintenance if r['product']==product_node]
 orders=[r for r in orders if r['product']==product_node]
 sh=Graph().parse(output/'shacl.ttl');SH=URIRef('http://www.w3.org/ns/shacl#ValidationResult');ns='http://www.w3.org/ns/shacl#'
 issues=[{k:str(sh.value(n,URIRef(ns+p)) or '') for k,p in [('focus','focusNode'),('path','resultPath'),('message','resultMessage')]} for n in sh.subjects(RDF.type,SH)]
 labels={e['id']:{'type':e['type'],'id':e['source']['recordId'],'name':e['attributes'].get('name','')} for e in mapped['entities']}
 files=[ROOT/'sidm.ttl',ROOT/'shapes.ttl',ROOT/'snapshot.py',ROOT/'answer.py',ROOT/'reasoning.py',ROOT/'import_graph.py',ROOT.parent/'mapping.json',*sorted((ROOT/'queries').glob('*.rq'))]
 result={
 'execution':{'engine':'OWL 2 + HermiT + SHACL + SPARQL','executedAt':datetime.now(timezone.utc).isoformat(),'capturedAt':raw['capturedAt'],'sourceTransport':raw['sourceTransport'],'sourceSha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'readCount':len(raw['calls']),'consistency':'non-transactional-read','productId':str(product_id),'projectId':str(project_id) if project_id else None,'filesSha256':{str(p.relative_to(ROOT.parent)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}},
 'validation':validation,'reasoning':reasoning,'issues':issues,'answers':annotate_answers(data,{'requirements':requirements,'projectOpenWork':work,'projectPayments':payments,'stagePayments':stage_payments,'maintenanceContracts':maintenance,'workOrders':orders},issues),'objects':labels,
 'limitations':[('本次工具调用实时授权读取；不代表线上平台已接入' if raw['sourceTransport'] in ('authorized-rest','authorized-controller') else '本轮授权读取的固定快照，非调用时重新读取；不代表线上平台已接入'),'各请求不在同一数据库事务内；项目付款按登记明细汇总，运维合同按录入即已付款的业务口径表达，不代替银行凭证','每条答案附相关校验状态；异常待核实的金额仅是登记数据计算，不作为已核对结论；不自动补全来源关系',('本轮读取运维合同和工单；不推断工单所属合同' if 'operations' in raw else '本轮未读取运维合同和工单')]}
 write(output/'answer.json',result)
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('product_id',type=int);p.add_argument('project_id',type=int);p.add_argument('output');a=p.parse_args();print(json.dumps(execute(a.source,a.product_id,a.project_id,a.output),ensure_ascii=False))
