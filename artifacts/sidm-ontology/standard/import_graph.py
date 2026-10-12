"""Map explicit assertions from an archived SIDM graph to RDF; no business inference.
The archived graph is an intermediate export, not an authoritative ontology.
"""
import json
import re
import hashlib
from pathlib import Path
from datetime import datetime
from rdflib import Graph, Namespace, URIRef, Literal, RDF, RDFS, OWL, XSD, BNode
from rdflib.collection import Collection
S=Namespace('urn:sidm:ontology:')
ROOT=Path(__file__).parent

def to_rdf(source):
 raw=json.loads(Path(source).read_text())
 if raw.get('datasetKind') not in ('api-read','api-export','fictional-demo'):
  raise ValueError('必须标注来源类型，不接受未标识的数据')
 model=Graph().parse(ROOT/'sidm.ttl')
 classes=set(model.subjects(RDF.type,OWL.Class))
 datatypes={p:model.value(p,RDFS.range) for p in model.subjects(RDF.type,OWL.DatatypeProperty)}
 objectprops=set(model.subjects(RDF.type,OWL.ObjectProperty))
 g=Graph();g.bind('s',S)
 ids={};seen=set()
 for record in raw['entities']:
  key=record['id']
  if key in ids or not isinstance(key,str) or not re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:[^\s<>"{}|\\^`]+$',key):
   raise ValueError('重复或无效对象IRI')
  ids[key]=URIRef(key)
  if S[record['type']] not in classes:raise ValueError('未知对象类型')
  g.add((ids[key],RDF.type,S[record['type']]))
 for record in raw['entities']:
  node=ids[record['id']]
  for name,value in record.get('attributes',{}).items():
   dt=datatypes.get(S[name])
   if dt is None:raise ValueError('未知数据属性: '+name)
   if dt==XSD.dateTime:
    if not isinstance(value,str):raise ValueError('日期不是字符串')
    if len(value)==10:
     datetime.strptime(value,'%Y-%m-%d');value+='T00:00:00Z'
    else:
     value=value.replace(' ','T')
     if re.search(r'[+-]\d{2}$',value):value+=':00'
     datetime.fromisoformat(value.replace('Z','+00:00'))
   elif dt==XSD.decimal:
    if not isinstance(value,str) or not re.fullmatch(r'-?\d+(?:\.\d{1,2})?',value):raise ValueError('金额必须为分精度十进制字符串')
   elif dt==XSD.integer:
    if not isinstance(value,int) or isinstance(value,bool):raise ValueError('整数格式错误')
   elif not isinstance(value,str):raise ValueError('文本格式错误')
   g.add((node,S[name],Literal(value,datatype=dt)))
  source_record=record.get('source',{})
  for key,prop in [('recordId','sourceId'),('environment','sourceEnvironment'),('capturedAt','sourceCapturedAt'),('endpoint','sourceEndpoint')]:
   if key in source_record:g.add((node,S[prop],Literal(str(source_record[key]))))
 for edge in raw['relations']:
  key=(edge['subject'],edge['relation'],edge['object'])
  if key in seen:raise ValueError('重复关系不能静默去重')
  seen.add(key)
  if key[0] not in ids or key[2] not in ids:raise ValueError('关系引用未导出的对象')
  if S[key[1]] not in objectprops:raise ValueError('未知对象属性')
  g.add((ids[key[0]],S[key[1]],ids[key[2]]))
 # Distinct record identities are known facts, not an implicit OWL unique-name assumption.
 if ids:
  head=BNode();all_different=BNode();Collection(g,head,list(ids.values()))
  g.add((all_different,RDF.type,OWL.AllDifferent));g.add((all_different,OWL.distinctMembers,head))
 snapshot=URIRef('urn:sidm:snapshot:'+hashlib.sha256(Path(source).read_bytes()).hexdigest())
 g.add((snapshot,S.datasetKind,Literal(raw['datasetKind'])))
 for key,prop in [('scope','sourceScope'),('consistency','sourceConsistency'),('unresolvedRelations','unresolvedRelations')]:
  if key in raw:g.add((snapshot,S[prop],Literal(json.dumps(raw[key],ensure_ascii=False))))
 for node in ids.values():g.add((node,S.sourceSnapshot,snapshot))
 return g
