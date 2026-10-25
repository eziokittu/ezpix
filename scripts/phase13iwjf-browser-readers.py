import importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
native=load('native','scripts/phase13hoih-readers.py');render=load('render','scripts/phase13iwjf-readers.py')
out=Path('artifacts/phase13iwjf-ui');meta=json.loads((out/'result.json').read_text());cases=json.loads(Path('artifacts/phase13iwjf-independent/cases.json').read_text())['cases'];checks=0
for f in meta['downloads']:
 c=cases[f['case']];p=out/f['name']
 if p.suffix=='.aseprite':
  r=native.read_native(p);assert (r['width'],r['height'],r['depth'])==(6,4,32);checks+=1
  assert len(r['layers'])==1 and r['layers'][0]['opacity']==255 and r['layers'][0]['flags']==3;checks+=1
  assert [r['planes'][i][0] for i in range(3)]==c['expected'];checks+=3
  assert r['types']==[[0],[0],[0]];checks+=1
  assert r['tags']==[dict(start=0,end=2,direction=2,repeat=0,name='Bounce')];checks+=1
  assert r['slices']==[dict(name='Body',values=[0,1,0,3,3,-1,4])];checks+=1
 else:checks+=render.verify_project(json.loads(p.read_text()),c)
result=dict(status='passed',version=meta['version'],buildId=meta['buildId'],files=len(meta['downloads']),checks=checks);(out/'readers.json').write_text(json.dumps(result,indent=2));print('PASS independent rendered native browser downloads',result)
