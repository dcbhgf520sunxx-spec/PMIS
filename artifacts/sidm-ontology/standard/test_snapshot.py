import copy,unittest,tempfile,json
from pathlib import Path
from snapshot import map_snapshot

def sample():
 return {'kind':'api-read','sourceTransport':'browser-authorized-rest','environment':'fixture:test','capturedAt':'2026-10-08T00:00:00Z','productId':'1','products':[{'id':1,'name':'虚构产品','owner_id':1}], 'requirements':[{'id':2,'product_id':1,'title':'虚构需求','owner_id':1,'status':36}], 'projects':[{'id':3,'product_id':1,'requirement_id':2,'name':'虚构项目','owner_id':1,'status':1}], 'tasks':[], 'delivery':{'bugs':[],'plans':[{'projectId':3,'project':{'id':3},'stages':[]}]},'commerce':[{'projectId':3,'contract':None,'payments':[]}], 'calls':[]}
class SnapshotTests(unittest.TestCase):
 def test_maps_source_without_inference(self):
  e,c=map_snapshot(sample());self.assertEqual(len(e['entities']),4);self.assertEqual(c,[])
  self.assertIn('sourceRequirement',[r['relation'] for r in e['relations']])
 def test_identity_is_environment_scoped(self):
  a=sample();b=copy.deepcopy(a);b['environment']='fixture:other'
  self.assertNotEqual(map_snapshot(a)[0]['entities'][0]['id'],map_snapshot(b)[0]['entities'][0]['id'])
 def test_rejects_wrong_product(self):
  a=sample();a['projects'][0]['product_id']=99
  with self.assertRaises(ValueError):map_snapshot(a)
 def test_rejects_dual_task_owner(self):
  a=sample();a['tasks']=[{'id':9,'source_type':1,'project_id':3,'requirement_id':2}]
  with self.assertRaises(ValueError):map_snapshot(a)
 def test_missing_source_is_preserved(self):
  a=sample();a['projects'][0]['requirement_id']=None
  e,_=map_snapshot(a);self.assertNotIn('sourceRequirement',[r['relation'] for r in e['relations']])
 def test_duplicate_business_record_rejected(self):
  a=sample();a['requirements']*=2
  with self.assertRaises(ValueError):map_snapshot(a)
 def test_partial_payments_never_complete(self):
  a=sample();a['commerce'][0]['contract']={'id':4,'project_id':3,'contract_amount':'100.00','stages':[{'id':5,'contract_id':4,'planned_amount':'100.00'}]}
  e,c=map_snapshot(a);self.assertEqual(c,[])
 def test_record_stage_mismatch_rejected(self):
  a=sample();a['commerce'][0]['contract']={'id':4,'project_id':3,'contract_amount':'100.00','stages':[{'id':5,'contract_id':4,'planned_amount':'100.00'}]};a['commerce'][0]['payments']=[{'stageId':5,'records':[{'id':6,'stage_id':99,'payment_amount':'10.00'}]}]
  with self.assertRaises(ValueError):map_snapshot(a)
 def test_maps_live_operations_without_inventing_contract_order_link(self):
  a=sample();a['operations']={'productId':1,'contracts':[{'id':8,'product_id':1,'contract_amount':'100.00','supplier_id':7,'status':'renewed','service_start_date':'2023-01-01','service_end_date':'2023-12-31'},{'id':9,'product_id':1,'contract_amount':'120.00','supplier_id':7,'previous_contract_id':8,'status':'active','service_start_date':'2024-01-01','service_end_date':'2024-12-31'}],'workOrders':[{'id':10,'product_id':1,'follower_id':1,'status':0,'urgency':2}]}
  mapped,_=map_snapshot(a);types=[e['type'] for e in mapped['entities']];relations=[e['relation'] for e in mapped['relations']]
  self.assertEqual(types.count('MaintenanceContract'),2);self.assertEqual(types.count('WorkOrder'),1)
  self.assertIn('previousContract',relations);self.assertIn('follower',relations)
  self.assertNotIn('orderContract',relations)
  a['operations']['workOrders'][0]['product_id']=2
  with self.assertRaises(ValueError):map_snapshot(a)
if __name__=='__main__':unittest.main()

class CompletenessTests(unittest.TestCase):
 def capture(self):
  a=sample();a['calls']=[{'path':'/products/1','params':{}},{'path':'/projects/3/stage-plan','params':{}},{'path':'/projects/3/contract','params':{}}]
  for name,filters,count in [('requirements',{'product_id':1},1),('projects',{'product_id':1},1),('tasks',{'requirement_id':2},0),('bugs',{'requirement_id':2},0),('tasks',{'project_id':3},0),('bugs',{'project_id':3},0)]:a['calls'].append({'path':'/'+name,'params':dict(filters,page=1,pageSize=100),'rows':count,'total':count})
  return a
 def test_complete_and_truncated_pages(self):
  from answer import check_reads
  a=self.capture();check_reads(a);a['calls'][-1]['total']=1
  with self.assertRaises(ValueError):check_reads(a)
 def test_missing_empty_list_evidence(self):
  from answer import check_reads
  a=self.capture();a['calls'].pop()
  with self.assertRaises(ValueError):check_reads(a)
 def test_payment_coverage_requires_all_stage_reads(self):
  a=self.capture();a['commerce'][0]['contract']={'id':4,'project_id':3,'contract_amount':'100.00','stages':[{'id':5,'contract_id':4,'planned_amount':'100.00'}]};a['commerce'][0]['payments']=[{'stageId':5,'records':[]}]
  self.assertEqual(map_snapshot(a)[1],[])
  a['calls'].append({'path':'/projects/3/contract/stages/5/payments','params':{},'rows':0})
  self.assertEqual(len(map_snapshot(a)[1]),2)
  a['calls'][-1]['rows']=1;self.assertEqual(map_snapshot(a)[1],[])
 def test_operations_read_evidence_required(self):
  from answer import check_reads
  a=self.capture();a['operations']={'productId':1,'contracts':[],'workOrders':[]}
  a['calls'].append({'path':'/products/1/maintenance-contracts','params':{},'rows':0})
  with self.assertRaises(ValueError):check_reads(a)
  a['calls'].append({'path':'/work-orders','params':{'product_id':1,'page':1,'pageSize':100},'rows':0,'total':0})
  check_reads(a)
