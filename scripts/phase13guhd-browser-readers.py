import base64,json,struct,sys,zlib
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
def permute(src,w,h,ow,oh,rot=0,fx=False,fy=False):
 rw,rh=(h,w) if rot in [90,270] else (w,h); out=[]
 for y in range(oh):
  for x in range(ow):
   rx=((2*(ow-1-x if fx else x)+1)*rw)//(2*ow); ry=((2*(oh-1-y if fy else y)+1)*rh)//(2*oh)
   sx,sy=(ry,h-1-rx) if rot==90 else (w-1-rx,h-1-ry) if rot==180 else (w-1-ry,rx) if rot==270 else (rx,ry); out.append(src[sy*w+sx])
 return out

p=Path('artifacts/phase13guhd-ui'); run=json.loads((p/'result.json').read_text()); doc=json.loads(Path('artifacts/phase13guhd-independent/fixture.ezpix').read_text()); w,h=doc['width'],doc['height']; src=list(base64.b64decode(doc['layers'][0]['cels'][0]['indices'])); checks=0
for c in run['downloads']:
 o=c['operation']; out=src.copy(); ow,oh=w,h
 if o['kind'] in ['selection','cut']:
  r=o['rect']; rw,rh=r['width'],r['height']; crop=[src[(r['y']+y)*w+r['x']+x] for y in range(rh) for x in range(rw)]
  if o['kind']=='cut' or not o['transform']['copy']:
   for y in range(r['y'],r['y']+rh):
    for x in range(r['x'],r['x']+rw): out[y*w+x]=doc['indexed']['transparentIndex']
  if o['kind']=='selection':
   t=o['transform']; rot=t.get('rotation',0); tw=t.get('width',rh if rot in [90,270] else rw); th=t.get('height',rw if rot in [90,270] else rh); pixels=permute(crop,rw,rh,tw,th,rot,t['flipX'],t['flipY'])
   for y in range(th): out[(t['y']+y)*w+t['x']:(t['y']+y)*w+t['x']+tw]=pixels[y*tw:(y+1)*tw]
 else:
  g=o['options']; k=g['kind']; ow=g.get('width',h if k=='rotate' and g['rotation'] in [90,270] else w); oh=g.get('height',w if k=='rotate' and g['rotation'] in [90,270] else h)
  if k in ['rotate','flip','scale']: out=permute(src,w,h,ow,oh,g.get('rotation',0),g.get('axis')=='horizontal',g.get('axis')=='vertical')
  else:
   x0,y0=(g['x'],g['y']) if k=='crop' else (-((ow-w)//2)-g['offsetX'],-((oh-h)//2)-g['offsetY'])
   out=[src[(y+y0)*w+x+x0] if 0<=x+x0<w and 0<=y+y0<h else doc['indexed']['transparentIndex'] for y in range(oh) for x in range(ow)]
 actual=json.loads((p/c['name']).read_text()); assert [actual['width'],actual['height']]==[ow,oh], (c['name'],[actual['width'],actual['height']],[ow,oh]); assert actual['indexed']==doc['indexed']; assert list(base64.b64decode(actual['layers'][0]['cels'][0]['indices']))==out; assert actual['layers'][0]['cels'][1]['link']=='frame-1'; checks+=4
for width in run['widths']:
 raw=json.loads((p/f'selection-{width}.ezindexed').read_text()); assert raw['palette']==doc['indexed']['palette']; assert base64.b64decode(raw['indices'])==bytes(src[y*w+x] for y in range(2) for x in range(3)); checks+=2
 new=json.loads((p/f'new-png-{width}.ezpix').read_text()); assert [new['width'],new['height']]==[w,h] and new['indexed']==doc['indexed']; assert base64.b64decode(new['layers'][0]['cels'][0]['indices'])==bytes(src); checks+=2
result={'status':'passed','version':run['version'],'buildId':run['buildId'],'checks':checks,'files':len(run['downloads'])+len(run['widths'])*2,'reader':'Independent Python integer selection and geometry mapping plus JSON/base64','completedAt':datetime.now(timezone.utc).isoformat()}; (p/'readers.json').write_text(json.dumps(result,indent=2)); print('PASS actual browser downloads',json.dumps(result))
