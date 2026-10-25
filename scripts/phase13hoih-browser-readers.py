import importlib.util,json,base64,sys
sys.dont_write_bytecode=True
from pathlib import Path
spec=importlib.util.spec_from_file_location('native','scripts/phase13hoih-readers.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
out=Path('artifacts/phase13hoih-ui');meta=json.loads((out/'result.json').read_text());cases={c['file']:c for c in json.loads(Path('artifacts/phase13hoih-independent/cases.json').read_text())};checks=0
for f in meta['downloads']:
 c=cases[f['original']];p=out/f['name']
 if p.suffix=='.aseprite':
  r=mod.read_native(p);assert r['depth']==c['depth'];assert r['palette']==c['palette'];assert [r['planes'][i][0] for i in range(3)]==c['planes'];assert r['types']==[[0],[1],[0]];checks+=4
  assert r['layers'][0]['opacity']==c['opacity'];assert bool(r['layers'][0]['flags']&2)!=c['locked'];assert r['tags'][0]['name']=='Run';assert r['slices'][0]['values'][-2:]==[-3,5];checks+=4
 else:
  j=json.loads(p.read_text());assert j['version']==16;assert j['layers'][0]['opacity']==c['opacity'];assert j['layers'][0]['locked']==c['locked'];assert j['tags'][0]['mode']==c['mode'];assert j['slices'][0]['pivotX']==-3;checks+=5
  if c['depth']==8:assert j['indexed']['palette']==c['palette'];checks+=1
  for i in range(3):
   v=j['layers'][0]['cels'][i]
   if i==1:assert v['link']=='frame-1'
   else:assert list(base64.b64decode(v['indices' if c['depth']==8 else 'rgba']))==c['planes'][i]
   checks+=1
result=dict(status='passed',version=meta['version'],buildId=meta['buildId'],files=len(meta['downloads']),checks=checks);(out/'readers.json').write_text(json.dumps(result,indent=2));print('PASS independent browser downloads',result)
