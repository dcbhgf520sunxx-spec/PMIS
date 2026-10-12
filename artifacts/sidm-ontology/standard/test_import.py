import unittest,json,tempfile
from pathlib import Path
from rdflib import RDF, XSD, URIRef
from import_graph import to_rdf,S
class ImportTests(unittest.TestCase):
 def sample(self,raw):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'input.json';p.write_text(json.dumps(raw));return to_rdf(p)
 def test_roundtrip_preserves_explicit_facts(self):
  g=self.sample({'datasetKind':'api-read','entities':[{'id':'urn:test:Project:1','type':'Project','attributes':{'startOn':'2026-09-01','name':'same'},'source':{'recordId':'1','environment':'test'}}],'relations':[]})
  n=URIRef('urn:test:Project:1');self.assertEqual(g.value(n,S.startOn).datatype,XSD.dateTime);self.assertEqual(str(g.value(n,S.sourceEnvironment)),'test');self.assertIsNone(g.value(n,S.sourceRequirement))
 def test_duplicate_identity_rejected(self):
  x={'id':'urn:test:1','type':'Person','attributes':{}}
  with self.assertRaises(ValueError):self.sample({'datasetKind':'api-read','entities':[x,x],'relations':[]})
 def test_invalid_calendar_rejected(self):
  with self.assertRaises(ValueError):self.sample({'datasetKind':'api-read','entities':[{'id':'urn:test:1','type':'Project','attributes':{'startOn':'2026-02-30'}}],'relations':[]})
 def test_unknown_source_not_accepted(self):
  with self.assertRaises(ValueError):self.sample({'entities':[],'relations':[]})
 def test_string_status_survives_standard_validation(self):
  from pyshacl import validate
  from rdflib import Graph, Namespace
  root=Path(__file__).parent;g=Graph().parse(root/'fixtures/valid.ttl')
  from rdflib import Literal
  g.set((Namespace('urn:sidm:fixture:').task,S.status,Literal('处理中',datatype=XSD.string)))
  self.assertTrue(validate(g,shacl_graph=str(root/'shapes.ttl'),ont_graph=str(root/'sidm.ttl'))[0])
if __name__=='__main__':unittest.main()
