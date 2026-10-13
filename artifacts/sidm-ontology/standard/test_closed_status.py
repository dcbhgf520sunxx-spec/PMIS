import unittest
from pathlib import Path
from rdflib import Graph, Literal, Namespace, RDF, XSD
from pyshacl import validate
from snapshot import map_snapshot
from test_snapshot import sample

ROOT = Path(__file__).parent
S = Namespace('urn:sidm:ontology:')
D = Namespace('urn:sidm:fixture:')


class ClosedStatusTests(unittest.TestCase):
 def test_source_closed_codes_map_to_business_status(self):
  raw = sample()
  raw['requirements'][0]['status'] = 37
  raw['projects'][0]['status'] = 4
  raw['tasks'] = [{'id': 9, 'source_type': 1, 'project_id': 3, 'status': 4}]
  raw['operations'] = {'productId': 1, 'contracts': [], 'workOrders': [{'id': 10, 'product_id': 1, 'status': 3}]}
  mapped, _ = map_snapshot(raw)
  for kind in ['Requirement', 'Project', 'Task', 'WorkOrder']:
   self.assertEqual(next(e for e in mapped['entities'] if e['type'] == kind)['attributes']['status'], '已关闭', kind)

 def test_closed_business_status_passes_shacl_without_closing_key_items(self):
  for node in [D.requirement, D.project, D.task, D.workOrder]:
   with self.subTest(node=node):
    data = Graph().parse(ROOT / 'fixtures/valid.ttl')
    self.assertTrue(list(data.objects(node, RDF.type)))
    data.set((node, S.status, Literal('已关闭', datatype=XSD.string)))
    self.assertTrue(validate(data, shacl_graph=str(ROOT / 'shapes.ttl'), ont_graph=str(ROOT / 'sidm.ttl'))[0])
  data = Graph().parse(ROOT / 'fixtures/valid.ttl')
  data.set((D.item, S.status, Literal('已关闭')))
  self.assertFalse(validate(data, shacl_graph=str(ROOT / 'shapes.ttl'), ont_graph=str(ROOT / 'sidm.ttl'))[0])

 def test_closed_task_remains_unfinished_but_is_not_unknown(self):
  query = (ROOT / 'queries/open-work.rq').read_text()
  for datatype in [None, XSD.string]:
   data = Graph()
   data.add((D.task, RDF.type, S.Task))
   data.add((D.task, S.status, Literal('已关闭', datatype=datatype)))
   self.assertEqual(str(list(data.query(query))[0].category), '未完成')


if __name__ == '__main__':
 unittest.main()
