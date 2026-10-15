"""Regression cases from the 2026-10-09 business-semantic review."""
import unittest,tempfile,json
from pathlib import Path
from rdflib import Graph,Namespace,Literal,XSD
from pyshacl import validate
import test_snapshot
from answer import execute
ROOT=Path(__file__).parent;S=Namespace('urn:sidm:ontology:');D=Namespace('urn:sidm:fixture:')
class BusinessGapTests(unittest.TestCase):
 def setUp(self):
  self.g=Graph().parse(ROOT/'fixtures/valid.ttl')
 def conforms(self):return validate(self.g,shacl_graph=str(ROOT/'shapes.ttl'),ont_graph=str(ROOT/'sidm.ttl'),inference='none')[0]
 def test_early_termination_allows_following_contract(self):
  for prop,value in [('serviceStartOn','2025-01-01'),('serviceEndOn','2025-12-31'),('terminationOn','2025-06-30')]:self.g.set((D.maintenance,S[prop],Literal(value+'T00:00:00Z',datatype=XSD.dateTime)))
  self.g.set((D.maintenance,S.terminationReason,Literal('双方提前终止',datatype=XSD.string)))
  self.g.set((D.maintenance,S.status,Literal('已终止',datatype=XSD.string)))
  self.g.set((D.renewal,S.serviceStartOn,Literal('2025-07-01T00:00:00Z',datatype=XSD.dateTime)))
  self.assertTrue(self.conforms())
 def test_termination_outside_service_rejected(self):
  self.g.set((D.maintenance,S.terminationOn,Literal('2030-01-01T00:00:00Z',datatype=XSD.dateTime)))
  self.assertFalse(self.conforms())
 def test_termination_requires_reason(self):
  self.g.set((D.maintenance,S.terminationOn,Literal('2025-06-30T00:00:00Z',datatype=XSD.dateTime)))
  self.assertFalse(self.conforms())
 def test_child_has_same_direct_source(self):
  self.g.remove((D.child,S.belongsToProject,None));self.g.add((D.child,S.belongsToRequirement,D.requirement))
  self.assertFalse(self.conforms())
 def test_no_grandchildren_in_current_sidm(self):
  for p,o in list(self.g.predicate_objects(D.child)):self.g.add((D.grandchild,p,o))
  self.g.set((D.grandchild,S.parentTask,D.child));self.assertFalse(self.conforms())
 def test_completed_parent_requires_completed_children(self):
  self.g.set((D.task,S.status,Literal('已完成',datatype=XSD.string)));self.g.set((D.child,S.status,Literal('待处理',datatype=XSD.string)))
  self.assertFalse(self.conforms())
 def test_requirement_type_controls_early_status(self):
  self.g.set((D.requirement,S.requirementType,Literal('直接实施',datatype=XSD.string)));self.g.set((D.requirement,S.status,Literal('需求上会',datatype=XSD.string)))
  self.assertFalse(self.conforms())
 def test_one_project_per_requirement_in_sidm(self):
  for p,o in list(self.g.predicate_objects(D.project)):self.g.add((D.secondProject,p,o))
  self.assertFalse(self.conforms())
 def test_one_contract_per_project_in_sidm(self):
  for p,o in list(self.g.predicate_objects(D.contract)):self.g.add((D.secondContract,p,o))
  for p,o in list(self.g.predicate_objects(D.stagePay)):self.g.add((D.secondStage,p,D.secondContract if p==S.stageContract else o))
  self.assertFalse(self.conforms())
 def test_one_successor_per_maintenance_contract(self):
  for p,o in list(self.g.predicate_objects(D.renewal)):self.g.add((D.secondRenewal,p,o))
  self.assertFalse(self.conforms())
 def test_payment_answer_marks_related_plan_problem(self):
  raw=test_snapshot.CompletenessTests().capture()
  raw['commerce'][0]['contract']={'id':4,'project_id':3,'supplier_id':7,'contract_amount':'100.00','stages':[{'id':5,'contract_id':4,'planned_amount':'90.00'}]}
  raw['commerce'][0]['payments']=[{'stageId':5,'records':[]}]
  raw['calls'].append({'path':'/projects/3/contract/stages/5/payments','params':{},'rows':0})
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'capture.json';p.write_text(json.dumps(raw));r=execute(p,1,3,Path(d)/'out')
  row=r['answers']['projectPayments'][0]
  self.assertEqual(row.get('validationStatus'),'异常待核实')
  self.assertTrue(row.get('validationIssues'))
  self.assertTrue(any('不是个人考核分母' in text and '不以更新时间或SHACL通过推定' in text for text in r['limitations']))
if __name__=='__main__':unittest.main()
