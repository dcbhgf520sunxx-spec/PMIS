"""Render a read-only ontology browser from authoritative OWL and SHACL files."""
from pathlib import Path
from rdflib import Graph,Namespace,RDF,RDFS,OWL,URIRef
from rdflib.collection import Collection
import json,hashlib
ROOT=Path(__file__).resolve().parent
S=Namespace('urn:sidm:ontology:');SH=Namespace('http://www.w3.org/ns/shacl#')
g=Graph().parse(ROOT/'sidm.ttl');sh=Graph().parse(ROOT/'shapes.ttl')
def key(u):return str(u).split(':')[-1]
def domains(u):
 if isinstance(u,URIRef):return [key(u)]
 union=g.value(u,OWL.unionOf)
 return [key(x) for x in Collection(g,union)] if union else []
def labels(u):return str(g.value(u,RDFS.label) or {'hasProject':'关联项目','relatedProduct':'关联产品'}.get(key(u),key(u)))
# Business wording stays in the confirmed business skeleton, rather than a second definition.
business_path=ROOT.parents[2]/'docs'/'SIDM业务骨架.md'
business=business_path.read_text()
def table_after(heading):
 section=business.split(heading,1)[1]
 lines=section.splitlines(); rows=[]; started=False
 for line in lines:
  if line.startswith('|'):
   cells=[v.strip() for v in line.strip().strip('|').split('|')]
   if not started:started=True;continue
   if all(set(v)<=set('-: ') for v in cells):continue
   rows.append(cells)
  elif started:break
 return rows
objects={r[0]:r[1:] for r in table_after('## 3. 核心对象')}
attributes={r[0]:r[1] for r in table_after('## 6. 关键业务属性与状态')}
states={r[0]:r[1] for r in table_after('**状态说明对象当前处于什么情况。**')}
quantities={r[0]:r[1] for r in table_after('### 4.1 关系的数量范围')}
roles=table_after('## 5. 人员与业务角色')
early_states=table_after('需求的前期状态随类型分别表达')
class_names={'Task':'任务及子任务'}
quantity_groups={
 'Product':['产品—需求、项目、运维工单','产品—产品运维合同'],
 'Requirement':['产品—需求、项目、运维工单','需求—项目','需求或项目—任务、BUG'],
 'Project':['需求—项目','项目—项目合同','项目—阶段—关键事项'],
 'ProjectStage':['项目—阶段—关键事项'],'KeyItem':['项目—阶段—关键事项'],
 'Task':['需求或项目—任务、BUG','任务—子任务'],'Bug':['需求或项目—任务、BUG'],
 'ProjectContract':['项目—项目合同','项目合同—付款阶段—付款记录','合同—供应商'],
 'PaymentStage':['项目合同—付款阶段—付款记录'],'PaymentRecord':['项目合同—付款阶段—付款记录'],
 'MaintenanceContract':['产品—产品运维合同','合同—供应商'],'WorkOrder':['产品—需求、项目、运维工单'],
 'Supplier':['合同—供应商'],'Person':['对象—人员']}
boundaries={
 'Product':'同属一个产品，不代表需求、项目、合同和工单两两直接关联。',
 'Requirement':'需求描述要解决的问题；转项目保留来源需求，原需求下的任务和BUG不会自动改挂项目。',
 'Project':'项目由需求转化。供应商参与且需要签合同，或周期较长、比较复杂，均可成为转项目的原因。项目完成以自身状态表达。',
 'ProjectStage':'项目阶段可建可不建；用于组织关键事项，与付款阶段不是同一种对象。',
 'KeyItem':'关键事项与任务分别管理，目前没有直接关联。排列顺序不等于前后依赖。',
 'Task':'主子任务是工作拆分，不能重复计算成果；任务的负责人不能由项目成员自动推定。',
 'Bug':'修复与关闭是不同状态；重新激活仍是原来的缺陷记录。',
 'ProjectContract':'合同金额是约定金额，实际付款按已登记付款记录汇总，不表示审批或支付办理已由SIDM完成。',
 'PaymentStage':'这是合同的金额安排，不是项目实施阶段；待付金额不表示已经满足支付条件。',
 'PaymentRecord':'OA审批完成并真正付款后再登记。付款月份与登记时间分开；漏登付款不会进入汇总。',
 'MaintenanceContract':'录入即表示已付款，合同金额按已付款金额表达，不另设运维付款阶段和明细。已续签不代表下一期已开始服务。',
 'WorkOrder':'工单归属产品，不默认关联某份运维合同，也不据此认定已转成需求或BUG。',
 'Supplier':'供应商是合作方，与内部人员角色分开表达。',
 'Person':'角色限定在具体业务对象上；一个角色不自动意味着另一个角色。'}
classes=[]
for c in sorted(g.subjects(RDF.type,OWL.Class),key=str):
 if not isinstance(c,URIRef):continue
 props=set();rules=[];checks=[]
 for shape in sh.subjects(SH.targetClass,c):
  for ps in sh.objects(shape,SH.property):
   prop=sh.value(ps,SH.path)
   if prop in set(g.subjects(RDF.type,OWL.DatatypeProperty)):props.add(prop)
   for message in sh.objects(ps,SH.message):rules.append(str(message))
   if isinstance(prop,URIRef):
    limits=[]
    low=sh.value(ps,SH.minCount);high=sh.value(ps,SH.maxCount)
    if low is not None and high is not None and int(low)==int(high):limits.append('必须有'+str(low)+'项')
    else:
     if low is not None:limits.append('至少'+str(low)+'项')
     if high is not None:limits.append('最多'+str(high)+'项')
    target_class=sh.value(ps,SH['class'])
    if target_class:limits.append('关联对象为'+labels(target_class))
    datatype=sh.value(ps,SH.datatype)
    if datatype:limits.append('数据类型：'+{'string':'文字','date':'日期','dateTime':'日期与时间','decimal':'金额数值','integer':'整数'}.get(str(datatype).split('#')[-1],str(datatype).split('#')[-1]))
    values=sh.value(ps,SH['in'])
    if values:limits.append('允许值：'+'、'.join(str(x) for x in Collection(sh,values)))
    if limits:checks.append({'label':labels(prop),'text':'；'.join(limits)})
  for check in sh.objects(shape,SH.sparql):
   for message in sh.objects(check,SH.message):rules.append(str(message))
 for prop in g.subjects(RDF.type,OWL.DatatypeProperty):
  if any(key(c) in domains(d) for d in g.objects(prop,RDFS.domain)):props.add(prop)
 classes.append({'id':key(c),'label':labels(c),'comments':sorted({str(x) for x in g.objects(c,RDFS.comment)}),'attributes':[{'id':key(x),'label':labels(x),'datatype':key(g.value(x,RDFS.range) or '')} for x in sorted(props,key=str)],'rules':sorted(set(rules)),'checks':checks})
assert len(objects)==14
for c in classes:
 name=class_names.get(c['id'],c['label'])
 assert name in objects, name
 state_name='项目、关键事项' if c['id'] in ('Project','KeyItem') else name
 attr_name='供应商、人员' if c['id'] in ('Supplier','Person') else name
 c['business']={'meaning':objects[name][0],'connections':objects[name][1],
  'attributes':attributes.get(attr_name,''),'states':states.get(state_name,''),
  'earlyStates':early_states if c['id']=='Requirement' else [],
  'quantities':[quantities[q] for q in quantity_groups[c['id']]],
  'roles':[{'role':r[0],'meaning':r[2] if c['id'] in ('Task','Person') else r[2].split('；任务允许')[0]} for r in roles if c['id']=='Person' or c['label'] in r[1].replace('、',',').split(',') or (c['id']=='Task' and '任务' in r[1].replace('、',',').split(','))],
  'boundary':boundaries[c['id']]}
relation_notes={
 'belongsToProduct':('指出需求、项目、工单或运维合同属于哪个产品。','每个对象只归属一个产品；一个产品可以承载多个对象。','同属一个产品，不产生对象之间的其他直接关系。'),
 'sourceRequirement':('指出项目是由哪条需求转化而来。','每个项目有一条来源需求；一条需求可以不转项目，至多对应一个项目。','项目与来源需求归属同一产品；不把已转项目当成已完成。'),
 'belongsToRequirement':('任务或BUG直接挂在需求下。','每个任务或BUG只能直接归属一条需求或一个项目。','需求转项目时，原有任务或BUG不会自动改挂项目。'),
 'belongsToProject':('任务或BUG直接挂在项目下。','每个任务或BUG只能直接归属一个项目或一条需求。','可追溯项目的来源需求，不因此同时直接归属需求。'),
 'stageProject':('指出一个实施阶段属于哪个项目。','项目阶段可选；一个项目可有多个阶段，每个阶段归属一个项目。','项目阶段组织关键事项，不是合同付款阶段。'),
 'itemStage':('指出关键事项安排在哪个项目阶段。','每个关键事项归属一个阶段；一个阶段可有多个事项。','事项与任务分别管理；排列顺序不等于前后依赖。'),
 'parentTask':('从子任务指向它所属的主任务。','主任务可拆多个子任务；每个子任务只有一个主任务，目前只支持两层。','主子任务直接归属相同；主任务已完成时，子任务必须均已完成。'),
 'contractProject':('指出建设合同对应哪个项目。','项目可以没有合同，至多一份；每份项目合同归属一个项目。','此关系用于项目合同，运维合同直接归属产品。'),
 'stageContract':('指出付款安排属于哪份项目合同。','一份合同有一个或多个付款阶段，每个阶段归属一份合同。','阶段计划金额合计等于合同金额；不是实施阶段。'),
 'recordStage':('指出实际付款登记在哪个付款阶段。','每笔付款记录归属一个阶段；每个阶段可有多笔记录。','先真实付款再登记；阶段与合同汇总不能再与明细重复相加。'),
 'supplier':('指出合同约定由哪个合作方提供服务。','每份项目合同或运维合同对应一个供应商；供应商可关联多份合同。','供应商身份不等于内部人员角色。'),
 'previousContract':('从新运维合同指向被续签的上一份合同。','按一份接一份的合同链管理，不采用并行合同或分叉续签。','新旧合同分别保留金额和期间；后一期服务开始晚于前一期有效结束，可能有间隔。'),
 'owner':('指出产品、需求、项目或关键事项的负责人。','责任按具体对象确定；人员可参与多个对象。','提出人、成员和协作人不能自动推定为负责人。'),
 'taskOwner':('指出负责执行这项任务的人员。','任务可有多名平级负责人。','不能因为某人是项目成员，就认定其负责所有项目任务。'),
 'member':('指出参与项目工作的人员。','项目可以有多名成员。','成员不自动成为任务负责人。'),
 'collaborator':('指出协助推进关键事项的人员。','关键事项可有多名协作人。','协作人与该事项负责人分别表达。'),
 'assignee':('指出被指派处理BUG的人员。','按具体BUG确定处理人员。','处理人身份不表示该BUG已经修复或关闭。'),
 'follower':('指出跟进运维工单的人员。','按具体工单确定跟进责任。','跟进人与提出人分别表达。'),
 'handler':('指出这笔实际付款的业务经办人员。','按每笔付款记录确定经办身份。','这是业务经办信息，不是付款审批人或支付执行授权。'),
 'submitter':('指出提出需求或使用问题的人员。','提出身份以对应需求或工单为范围。','提出人不等于负责人或跟进人。'),
 'hasProject':('从需求反向找到以它为来源的项目。','一条需求最多对应一个项目，也可以没有项目。','依据项目的来源需求关系推导，不新增一个项目。'),
 'relatedProduct':('从任务或BUG，经它直接归属的需求或项目，找到所属产品。','沿已有直接归属关系追溯。','只推导产品归属；不把任务或BUG改挂，也不推导为所有同产品对象的直接关联。')}
relations=[]
for p in sorted(g.subjects(RDF.type,OWL.ObjectProperty),key=str):
 source=sum([domains(d) for d in g.objects(p,RDFS.domain)],[])
 target=sum([domains(d) for d in g.objects(p,RDFS.range)],[])
 inverse=g.value(p,OWL.inverseOf)
 if inverse:
  source=sum([domains(d) for d in g.objects(inverse,RDFS.range)],[])
  target=sum([domains(d) for d in g.objects(inverse,RDFS.domain)],[])
 for chain in g.objects(p,OWL.propertyChainAxiom):
  parts=list(Collection(g,chain))
  source.extend(sum([domains(d) for d in g.objects(parts[0],RDFS.domain)],[]))
  if not target:target=sum([domains(d) for d in g.objects(parts[-1],RDFS.range)],[])
 relations.append({'id':key(p),'label':labels(p),'from':sorted(set(source)),'to':sorted(set(target)),'inferred':bool(inverse or g.value(p,OWL.propertyChainAxiom)),'meaning':relation_notes[key(p)][0],'quantity':relation_notes[key(p)][1],'boundary':relation_notes[key(p)][2],'proof':(['反向读取：'+labels(inverse)] if inverse else [' → '.join(labels(x) for x in Collection(g,chain)) for chain in g.objects(p,OWL.propertyChainAxiom)])})
assert all(r['from'] and r['to'] for r in relations),'Every property must be displayed, including inverse/chain endpoints'
model={'businessSha256':hashlib.sha256(business_path.read_bytes()).hexdigest(),'classes':classes,'relations':relations,'version':str(g.value(URIRef('urn:sidm:ontology'),OWL.versionInfo)),'sha256':hashlib.sha256((ROOT/'sidm.ttl').read_bytes()).hexdigest(),'shapesSha256':hashlib.sha256((ROOT/'shapes.ttl').read_bytes()).hexdigest()}
assert len(classes)==14 and len(relations)==22
(ROOT/'model-view-data.cjs').write_text('// Generated by render-model.py; do not edit.\nmodule.exports = '+json.dumps(model,ensure_ascii=False,indent=2)+';\n')
html=(ROOT/'model-view-template.html').read_text().replace('__MODEL_DATA__',json.dumps(model,ensure_ascii=False).replace('</','<\\/'))
(ROOT.parent/'SIDM本体关系图.html').write_text(html)
print('Generated 14 classes, 20 direct and 2 inferred properties from OWL; SHACL annotations included.')
