import unittest
from pathlib import Path
from rdflib import Graph,RDF,RDFS,OWL,Namespace,Literal,XSD
from reasoning import reason
ROOT=Path(__file__).parent;S=Namespace('urn:sidm:ontology:');D=Namespace('urn:sidm:fixture:')
class ReasoningTests(unittest.TestCase):
 def test_standard_reasoner_entails_chain_and_inverse(self):
  g=Graph().parse(ROOT/'fixtures/valid.ttl');result,inferred=reason(g)
  self.assertTrue(result['consistent']);self.assertEqual(result['unsatisfiableClasses'],[])
  self.assertIn((D.task,S.relatedProduct,D.product),inferred)
  self.assertIn((D.requirement,S.hasProject,D.project),inferred)
  self.assertNotIn((D.task,S.belongsToRequirement,D.requirement),inferred)
 def test_disjoint_stage_contradiction(self):
  g=Graph().parse(ROOT/'fixtures/valid.ttl');g.add((D.stagePay,RDF.type,S.ProjectStage));r,_=reason(g);self.assertFalse(r['consistent'])
 def test_missing_source_open_world_consistent(self):
  g=Graph().parse(ROOT/'fixtures/valid.ttl');g.remove((D.project,S.sourceRequirement,None));r,_=reason(g);self.assertTrue(r['consistent'])
 def test_reasoning_preserves_asserted_decimal_precision(self):
  g=Graph().parse(ROOT/'fixtures/valid.ttl');value=Literal('9007199254740993.01',datatype=XSD.decimal)
  g.set((D.contract,S.amount,value));g.set((D.stagePay,S.plannedAmount,value))
  r,inferred=reason(g);self.assertTrue(r['consistent']);self.assertEqual(set(inferred.objects(D.contract,S.amount)),{value})
 def test_unsatisfiable_class_without_instance(self):
  g=Graph().parse(ROOT/'fixtures/valid.ttl');g.add((D.Impossible,RDF.type,OWL.Class));g.add((D.Impossible,RDFS.subClassOf,S.ProjectStage));g.add((D.Impossible,RDFS.subClassOf,S.PaymentStage))
  r,_=reason(g);self.assertTrue(r['consistent']);self.assertIn(str(D.Impossible),r['unsatisfiableClasses'])
if __name__=='__main__':unittest.main()
