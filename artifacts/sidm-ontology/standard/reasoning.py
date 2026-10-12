"""Run HermiT itself on lossless RDF/XML and decode its reported conclusions.
Owlready2 supplies the bundled Java reasoner/CLI; its Python quadstore is not
used because its decimal conversion can round large monetary values.
"""
import os,re,tempfile,subprocess
from pathlib import Path
from rdflib import Graph,URIRef,RDF,RDFS,OWL
import owlready2
ROOT=Path(__file__).parent

def java_path():
 explicit=os.environ.get('SIDM_ONTOLOGY_JAVA')
 if explicit:return explicit
 options=list((ROOT/'.runtime').glob('**/bin/java'))
 if options:return str(options[0].resolve())
 return 'java'

def reason(data,log_path=None):
 combined=Graph().parse(ROOT/'sidm.ttl');combined+=data
 hermit=Path(owlready2.__file__).parent/'hermit'
 with tempfile.TemporaryDirectory() as tmp:
  path=Path(tmp)/'input.owl';combined.serialize(path,format='xml')
  cmd=[java_path(),'-Xmx512M','-cp',os.pathsep.join([str(hermit),str(hermit/'HermiT.jar')]),'org.semanticweb.HermiT.cli.CommandLine','-c','-O','-D','-I',path.as_uri(),'-Y']
  process=subprocess.run(cmd,capture_output=True,text=True,timeout=90)
  text=process.stdout+'\n'+process.stderr
  if log_path:
   Path(log_path).write_text(text)
   Path(log_path).with_suffix('.input.owl').write_bytes(path.read_bytes())
  if process.returncode==1 and 'Inconsistent ontology' in text:
   return {'reasoner':'HermiT','interface':'Java CLI on original RDF/XML','consistent':False,'unsatisfiableClasses':None},Graph()
  if process.returncode!=0 or 'known instances:' not in text:
   raise RuntimeError('HermiT执行失败或输出契约变化：'+text[:2000])
  out=Graph()+combined;unsat=set()
  # Decode only conclusions actually printed by HermiT; do not implement inference rules here.
  for relation,iris in re.findall(r'^([A-Za-z]+)\( ((?:<[^>]+>\s*)+) \)$',text,re.M):
   nodes=[URIRef(x) for x in re.findall(r'<([^>]+)>',iris)]
   if relation=='EquivalentClasses' and OWL.Nothing in nodes:unsat.update(str(x) for x in nodes if x!=OWL.Nothing)
   predicate={'Type':RDF.type,'SubClassOf':RDFS.subClassOf,'SubObjectPropertyOf':RDFS.subPropertyOf,'SubDataPropertyOf':RDFS.subPropertyOf}.get(relation)
   if predicate and len(nodes)==2:out.add((nodes[0],predicate,nodes[1]))
  for prop,known in re.findall(r'^<([^>]+)> \(known instances:\s*(.*?)\s*\|\s*possible instances:',text,re.M):
   for left,right in re.findall(r'\(<([^>]+)>, <([^>]+)>\)',known):out.add((URIRef(left),URIRef(prop),URIRef(right)))
  return {'reasoner':'HermiT','interface':'Java CLI on original RDF/XML','consistent':True,'unsatisfiableClasses':sorted(unsat)},out
