import unittest
from pathlib import Path
from rdflib import Graph, Namespace, RDF, RDFS, OWL, Literal, XSD, URIRef
from pyshacl import validate
ROOT=Path(__file__).parent
S=Namespace('urn:sidm:ontology:')
D=Namespace('urn:sidm:fixture:')
class StandardTests(unittest.TestCase):
 def setUp(self):
  self.onto=Graph().parse(ROOT/'sidm.ttl')
  self.shapes=Graph().parse(ROOT/'shapes.ttl')
  self.data=Graph().parse(ROOT/'fixtures/valid.ttl')
 def check(self,g):return validate(g,shacl_graph=self.shapes,ont_graph=self.onto,inference='none',advanced=False)[0]
 def test_standard_files_and_14_classes(self):
  self.assertEqual(len({x for x in self.onto.subjects(RDF.type,OWL.Class) if isinstance(x,URIRef)}),14)
  self.assertTrue(self.check(self.data))
 def test_business_properties_have_chinese_labels_and_equal_owl_export(self):
  for kind in [OWL.DatatypeProperty,OWL.ObjectProperty]:
   for prop in self.onto.subjects(RDF.type,kind):
    labels=[str(label) for label in self.onto.objects(prop,RDFS.label) if label.language=='zh']
    self.assertTrue(labels,str(prop))
    self.assertTrue(any(any('\u3400'<=char<='\u9fff' for char in label) for label in labels),str(prop))
  self.assertTrue(self.onto.isomorphic(Graph().parse(ROOT/'sidm.owl')))
 def test_missing_source_is_shacl_violation(self):
  self.data.remove((D.project,S.sourceRequirement,None));self.assertFalse(self.check(self.data))
 def test_dual_task_ownership(self):
  self.data.add((D.task,S.belongsToRequirement,D.requirement));self.assertFalse(self.check(self.data))
 def test_wrong_relation_target(self):
  self.data.set((D.project,S.sourceRequirement,D.person));self.assertFalse(self.check(self.data))
 def test_cross_product(self):
  self.data.add((D.other,RDF.type,S.Product));self.data.add((D.other,S.owner,D.person));self.data.set((D.requirement,S.belongsToProduct,D.other));self.assertFalse(self.check(self.data))
 def test_parent_cycle(self):
  self.data.add((D.task,S.parentTask,D.task));self.assertFalse(self.check(self.data))
 def test_renewal_overlap_and_cycle(self):
  self.data.set((D.renewal,S.serviceStartOn,Literal('2026-01-01T00:00:00Z',datatype=XSD.dateTime)));self.assertFalse(self.check(self.data))
 def test_overpayment(self):
  self.data.set((D.payment,S.amount,Literal('120000.00',datatype=XSD.decimal)));self.assertFalse(self.check(self.data))
 def test_contract_plan_mismatch(self):
  self.data.set((D.stagePay,S.plannedAmount,Literal('90000.00',datatype=XSD.decimal)));self.assertFalse(self.check(self.data))
 def test_positive_amount(self):
  self.data.set((D.payment,S.amount,Literal('0.00',datatype=XSD.decimal)));self.assertFalse(self.check(self.data))
 def test_status_enum(self):
  self.data.set((D.task,S.status,Literal('已续签')));self.assertFalse(self.check(self.data))
 def test_optional_stage_contract(self):
  g=Graph()
  for t in self.data:
   if t[0] in [D.product,D.requirement,D.project,D.person]:g.add(t)
  self.assertTrue(self.check(g))
 def test_sparql_payment_uses_decimal(self):
  rows=list(self.data.query((ROOT/'queries/payments.rq').read_text()))
  self.assertEqual(len(rows),1);self.assertEqual(str(rows[0].paid),'30000.00');self.assertEqual(str(rows[0].unpaid),'70000.00')
 def test_sparql_operations_keep_renewal_and_order_separate(self):
  contracts=list(self.data.query((ROOT/'queries/maintenance-contracts.rq').read_text()))
  orders=list(self.data.query((ROOT/'queries/work-orders.rq').read_text()))
  self.assertEqual(len(contracts),2);self.assertEqual(len(orders),1)
  self.assertEqual(str(next(r for r in contracts if r.contract==D.renewal).previous),str(D.maintenance))
  self.assertEqual(str(orders[0].follower),str(D.person))
 def test_maintenance_entry_means_paid_without_payment_records(self):
  rows=list(self.data.query((ROOT/'queries/maintenance-contracts.rq').read_text()))
  self.assertEqual(len(rows),2)
  for row in rows:
   self.assertEqual(row.paid,row.amount)
   self.assertEqual(str(row.paymentStatus),'已付款')
   self.assertEqual(str(row.paymentBasis),'运维合同录入即表示已付款，无单独付款明细')
 def test_maintenance_invalid_amount_does_not_invent_paid_total(self):
  for amount in [None,Literal('0.00',datatype=XSD.decimal),Literal('-1.00',datatype=XSD.decimal)]:
   g=Graph()+self.data;g.remove((D.maintenance,S.amount,None))
   if amount is not None:g.add((D.maintenance,S.amount,amount))
   row=next(r for r in g.query((ROOT/'queries/maintenance-contracts.rq').read_text()) if r.contract==D.maintenance)
   self.assertIsNone(row.paid)
   self.assertEqual(str(row.paymentStatus),'待核实')
 def test_meta_shacl(self):
  self.assertTrue(validate(self.data,shacl_graph=self.shapes,ont_graph=self.onto,meta_shacl=True)[0])
 def test_attribute_on_wrong_class(self):
  self.data.add((D.person,S.amount,Literal('100.00',datatype=XSD.decimal)));self.assertFalse(self.check(self.data))
 def test_stage_payment_states(self):
  query=(ROOT/'queries/stage-payments.rq').read_text()
  self.assertEqual(str(list(self.data.query(query))[0].paymentStatus),'部分付款')
  self.data.remove((D.payment,None,None));self.assertEqual(str(list(self.data.query(query))[0].paymentStatus),'未付款')
  self.data.add((D.payment,S.recordStage,D.stagePay));self.data.add((D.payment,S.amount,Literal('100000.00',datatype=XSD.decimal)))
  self.assertEqual(str(list(self.data.query(query))[0].paymentStatus),'已付清')
 def test_unknown_payment_coverage_is_not_zero(self):
  self.data.remove((D.contract,S.paymentsComplete,None));self.data.remove((D.stagePay,S.paymentsComplete,None));self.data.remove((D.payment,None,None))
  r=list(self.data.query((ROOT/'queries/payments.rq').read_text()))[0]
  self.assertIsNone(r.paid);self.assertEqual(str(r.coverage),'完整性或金额有效性未证实')
 def test_empty_graph_has_no_phantom_payment_row(self):
  for name in ['payments','stage-payments']:
   self.assertEqual(list(Graph().query((ROOT/'queries'/f'{name}.rq').read_text())),[])
 def test_unknown_work_status_is_not_open_or_closed(self):
  self.data.set((D.task,S.status,Literal('未知状态')))
  rows=list(self.data.query((ROOT/'queries/open-work.rq').read_text()))
  self.assertEqual(str(next(r for r in rows if r.work==D.task).category),'待核实')
 def test_typed_status_matches_known_work_category(self):
  query=(ROOT/'queries/open-work.rq').read_text()
  for cls,status,expected in [(S.Task,'待处理','未完成'),(S.KeyItem,'未开始','未完成'),(S.Bug,'已修复','待关闭')]:
   for datatype in [None,XSD.string]:
    g=Graph();g.add((D.work,RDF.type,cls));g.add((D.work,S.status,Literal(status,datatype=datatype)))
    self.assertEqual(str(list(g.query(query))[0].category),expected)
 def test_invalid_payment_amount_withholds_totals(self):
  for value in [None,Literal('0.00',datatype=XSD.decimal),Literal('-1.00',datatype=XSD.decimal)]:
   g=Graph()+self.data;g.remove((D.payment,S.amount,None))
   if value is not None:g.add((D.payment,S.amount,value))
   for name in ['payments','stage-payments']:
    r=list(g.query((ROOT/'queries'/f'{name}.rq').read_text()))[0]
    self.assertIsNone(r.paid);self.assertIsNone(r.unpaid)
    if name=='stage-payments':self.assertEqual(str(r.paymentStatus),'待核实')
if __name__=='__main__':unittest.main()
