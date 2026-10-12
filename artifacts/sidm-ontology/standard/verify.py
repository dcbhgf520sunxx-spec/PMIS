"""Reproducible standard-tool pipeline. No business facts are written back to SIDM."""
import json,hashlib,subprocess,sys,platform,zipfile
import owlready2
from datetime import datetime,timezone
from pathlib import Path
from importlib.metadata import version
from rdflib import Graph,Namespace,RDF,OWL,URIRef
from pyshacl import validate
from reasoning import reason,java_path
from import_graph import to_rdf
ROOT=Path(__file__).resolve().parent
S=Namespace('urn:sidm:ontology:');D=Namespace('urn:sidm:fixture:');SH=Namespace('http://www.w3.org/ns/shacl#')

def write_json(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def validate_data(data,output):
 conforms,report,text=validate(data,shacl_graph=str(ROOT/'shapes.ttl'),ont_graph=str(ROOT/'sidm.ttl'),inference='none',meta_shacl=True)
 report.serialize(output.with_suffix('.ttl'),format='turtle');output.with_suffix('.txt').write_text(text)
 return {'conforms':bool(conforms),'violations':len(list(report.subjects(RDF.type,SH.ValidationResult)))}
def query_all(graph,output,scope=None):
 write_json(output/'query-scope.json',scope or {'kind':'fictional-complete-fixture','note':'仅对虚构样例范围作答'})
 results={}
 for path in sorted((ROOT/'queries').glob('*.rq')):
  r=graph.query(path.read_text());serialized=json.loads(r.serialize(format='json'))
  write_json(output/(path.stem+'.json'),serialized);results[path.stem]=len(serialized['results']['bindings'])
 return results

def main():
 reports=ROOT/'reports';reports.mkdir(exist_ok=True)
 subprocess.run([sys.executable,'-m','unittest','discover','-s',str(ROOT),'-p','test_*.py','-v'],check=True)
 ontology=Graph().parse(ROOT/'sidm.ttl');ontology.serialize(ROOT/'sidm.owl',format='xml')
 assert ontology.isomorphic(Graph().parse(ROOT/'sidm.owl')),'RDF/XML与Turtle模型不等价'
 data=Graph().parse(ROOT/'fixtures/valid.ttl')
 business_source=ROOT.parents[2]/'docs/SIDM业务骨架.md'
 manifest={'runAt':datetime.now(timezone.utc).isoformat(),'tools':{p:version(p) for p in ['rdflib','pyshacl','owlready2']},'python':platform.python_version(),'java':subprocess.run([java_path(),'-version'],capture_output=True,text=True,check=True).stderr.strip(),'modelSha256':digest(ROOT/'sidm.ttl'),'shapesSha256':digest(ROOT/'shapes.ttl'),'businessSkeletonSha256':digest(business_source) if business_source.exists() else None,'businessSkeletonSourceStatus':'provided' if business_source.exists() else 'not-provided','mode':'local-standard-tools-not-online-deployment'}
 manifest['demoValidation']=validate_data(data,reports/'demo-shacl');assert manifest['demoValidation']['conforms']
 result,inferred=reason(data,reports/'demo-hermit.log');assert result['consistent'] and not result['unsatisfiableClasses'];manifest['demoReasoning']=result
 inferred.serialize(reports/'demo-inferred.ttl',format='turtle');manifest['demoQueries']=query_all(inferred,reports)
 assert (D.task,S.relatedProduct,D.product) in inferred and (D.requirement,S.hasProject,D.project) in inferred
 missing=Graph()+data;missing.remove((D.project,S.sourceRequirement,None));missing.serialize(ROOT/'fixtures/missing-source.ttl',format='turtle')
 r,_=reason(missing,reports/'missing-source-hermit.log');v=validate_data(missing,reports/'missing-source-shacl');assert r['consistent'] and not v['conforms'];manifest['openWorldComparison']={'reasoning':r,'validation':v}
 contradiction=Graph()+data;contradiction.add((D.stagePay,RDF.type,S.ProjectStage));contradiction.serialize(ROOT/'fixtures/contradiction.ttl',format='turtle');r,_=reason(contradiction,reports/'contradiction-hermit.log');assert not r['consistent'];manifest['contradiction']=r
 # Previously authorized, archived export graphs. Missing samples are reported, never treated as passes.
 local=ROOT/'local-output';local.mkdir(exist_ok=True,mode=0o700);local.chmod(0o700);manifest['archivedSamples']=[]
 for name in ['local-delivery-chain.json','local-operations-75-chain.json']:
  source=local/'archived-input'/name
  if not source.exists():manifest['archivedSamples'].append({'file':name,'status':'not-provided'});continue
  graph=to_rdf(source);out=local/name.removesuffix('.json');out.mkdir(exist_ok=True)
  graph.serialize(out/'asserted.ttl',format='turtle');v=validate_data(graph,out/'shacl')
  r,inf=reason(graph,out/'hermit.log')
  if r['consistent']:inf.serialize(out/'inferred.ttl',format='turtle');counts=query_all(inf,out,{'kind':'archived-export-only','scope':json.loads(source.read_text()).get('scope',{}),'note':'行数仅指已加载样本；未声明paymentsComplete时paid/unpaid不绑定，observedPaid仅为已加载明细合计'})
  else:counts={}
  row={'file':name,'sourceSha256':digest(source),'mode':'archived-export-not-fresh-read','reasoning':r,'validation':v,'queryRowCounts':counts}
  write_json(out/'result.json',row);manifest['archivedSamples'].append(row)
 jar=Path(owlready2.__file__).parent/'hermit/HermiT.jar'
 with zipfile.ZipFile(jar) as z:info=z.read('META-INF/MANIFEST.MF').decode()
 manifest['hermit']={'jarSha256':digest(jar),'implementationVersion':next(x.split(': ',1)[1] for x in info.splitlines() if x.startswith('Implementation-Version:'))}
 manifest['querySha256']={p.name:digest(p) for p in sorted((ROOT/'queries').glob('*.rq'))}
 manifest['sourceFiles']={str(p.relative_to(ROOT)):digest(p) for p in sorted(ROOT.glob('*.py'))}
 write_json(reports/'verification.json',manifest)
 print(json.dumps(manifest,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
