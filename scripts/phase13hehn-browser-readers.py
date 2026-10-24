import json,base64,sys
sys.dont_write_bytecode=True
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
import importlib.util
spec=importlib.util.spec_from_file_location('oracle','scripts/phase13hehn-readers.py'); oracle=importlib.util.module_from_spec(spec); spec.loader.exec_module(oracle); expected=oracle.expected;mask_for=oracle.mask_for

p=Path('artifacts/phase13hehn-ui'); run=json.loads((p/'result.json').read_text()); doc=json.loads(Path('artifacts/phase13hehn-independent/fixture.ezpix').read_text()); w,h=doc['width'],doc['height'];src=list(base64.b64decode(doc['layers'][0]['cels'][0]['indices'])); checks=0
for c in run['downloads']:
 o=c['operation']; m,out=expected(src,w,h,o['rect'],o['method'],o,doc['indexed']['transparentIndex']); actual=json.loads((p/c['name']).read_text()); assert [actual['width'],actual['height']]==[w,h]; assert actual['indexed']==doc['indexed']; assert list(base64.b64decode(actual['layers'][0]['cels'][0]['indices']))==out; assert actual['layers'][0]['cels'][1]['link']=='frame-1';checks+=4
r={'x':0,'y':0,'width':4,'height':3}; mask=mask_for(src,w,h,r,'ellipse'); crop=[src[y*w+x] if mask[y*4+x] else doc['indexed']['transparentIndex'] for y in range(3) for x in range(4)]
for width in run['widths']:
 file=json.loads((p/f'selection-{width}.ezindexed').read_text());assert file['palette']==doc['indexed']['palette'];assert list(base64.b64decode(file['indices']))==crop;checks+=2
 assert Image.open(p/f'mask-{width}.png').convert('RGBA').tobytes()==bytes(v for a in mask for v in ([255,255,255,255] if a else [0,0,0,255]));checks+=1
 pasted=json.loads((p/f'paste-{width}.ezpix').read_text());out=src.copy()
 for y in range(3):
  for x in range(4):
   if mask[y*4+x]:out[y*w+x]=doc['indexed']['transparentIndex']
 for y in range(3):out[(y+3)*w+4:(y+3)*w+8]=crop[y*4:(y+1)*4]
 assert list(base64.b64decode(pasted['layers'][0]['cels'][0]['indices']))==out;checks+=1
result={'status':'passed','version':run['version'],'buildId':run['buildId'],'checks':checks,'files':len(run['downloads'])+len(run['widths'])*3,'reader':'Independent Python slot masks, integer transforms, erosion, JSON/base64 and Pillow on actual downloads','completedAt':datetime.now(timezone.utc).isoformat()};(p/'readers.json').write_text(json.dumps(result,indent=2));print('PASS actual indexed mask downloads',json.dumps(result))
