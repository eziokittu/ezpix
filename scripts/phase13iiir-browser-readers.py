import importlib.util,json,sys,base64
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('inks','scripts/phase13iiir-readers.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
out=Path('artifacts/phase13iiir-ui');meta=json.loads((out/'result.json').read_text());cases=json.loads(Path('artifacts/phase13iiir-independent/cases.json').read_text())['cases'];checks=0
for f in meta['downloads']:
 c=cases[f['case']];source=c['before'];want=mod.cel(source) if f['state']=='before' else mod.expected(source,c['operation']);j=json.loads((out/f['file']).read_text())
 assert j['version']==16 and j['indexed']==source['indexed'];checks+=2
 assert mod.cel(j)==want and mod.cel(j,0,1)==want;checks+=2
 assert j['layers'][0]['cels'][1]['link']=='frame-1';checks+=1
 assert mod.cel(j,0,2)==mod.cel(source,0,2);checks+=1
 for frame in range(3):assert mod.cel(j,1,frame)==mod.cel(source,1,frame);checks+=1
 assert j['frames']==source['frames'] and not j['layers'][1]['visible'];checks+=1
for f in meta['stampFiles']:
 j=json.loads((out/f).read_text());source=cases[0]['before'];assert j['palette']==source['indexed']['palette'];assert j['transparentIndex']==0;assert (j['width'],j['height'])==(3,2);assert list(base64.b64decode(j['indices']))==[1,2,3,4,5,0];checks+=4
result=dict(status='passed',version=meta['version'],buildId=meta['buildId'],checks=checks,files=len(meta['downloads'])+len(meta['stampFiles']));(out/'readers.json').write_text(json.dumps(result,indent=2));print('PASS independent indexed ink downloads',result)
