import base64,json,struct,sys,zlib
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
p=Path(sys.argv[1]); m=json.loads((p/'cases.json').read_text()); checks=0
def permute(src,w,h,ow,oh,rot=0,fx=False,fy=False):
 rw,rh=(h,w) if rot in [90,270] else (w,h); out=[]
 for y in range(oh):
  for x in range(ow):
   rx=((2*(ow-1-x if fx else x)+1)*rw)//(2*ow); ry=((2*(oh-1-y if fy else y)+1)*rh)//(2*oh)
   sx,sy=(ry,h-1-rx) if rot==90 else (w-1-rx,h-1-ry) if rot==180 else (w-1-ry,rx) if rot==270 else (rx,ry); out.append(src[sy*w+sx])
 return out
for c in m['cases']:
 b=c['before']; w,h=b['width'],b['height']; src=list(base64.b64decode(b['indices'])); out=src.copy(); o=c['operation']; ow,oh=w,h; x0=y0=0
 if o['kind'] in ['selection','cut']:
  r=o['rect']; rw,rh=r['width'],r['height']; cropped=[src[(r['y']+y)*w+r['x']+x] for y in range(rh) for x in range(rw)]
  if o['kind']=='cut' or not o['transform']['copy']:
   for y in range(r['y'],r['y']+rh):
    for x in range(r['x'],r['x']+rw): out[y*w+x]=b['transparentIndex']
  if o['kind']=='selection':
   t=o['transform']; rot=t.get('rotation',0); tw=t.get('width',rh if rot in [90,270] else rw); th=t.get('height',rw if rot in [90,270] else rh); transformed=permute(cropped,rw,rh,tw,th,rot,t['flipX'],t['flipY'])
   for y in range(th): out[(t['y']+y)*w+t['x']:(t['y']+y)*w+t['x']+tw]=transformed[y*tw:(y+1)*tw]
 else:
  g=o['options']; k=g['kind']; ow=g.get('width',h if k=='rotate' and g['rotation'] in [90,270] else w); oh=g.get('height',w if k=='rotate' and g['rotation'] in [90,270] else h)
  if k in ['rotate','flip','scale']: out=permute(src,w,h,ow,oh,g.get('rotation',0),g.get('axis')=='horizontal',g.get('axis')=='vertical')
  else:
   if k=='crop': x0,y0=g['x'],g['y']
   else:
    def anchor(a,d): return 0 if a=='start' else d if a=='end' else d//2
    x0=-anchor(g['anchorX'],ow-w)-g['offsetX']; y0=-anchor(g['anchorY'],oh-h)-g['offsetY']
   out=[src[(y+y0)*w+x+x0] if 0<=x+x0<w and 0<=y+y0<h else b['transparentIndex'] for y in range(oh) for x in range(ow)]
 actual=json.loads((p/c['raw']).read_text()); assert [actual['width'],actual['height']]==[ow,oh]; assert list(base64.b64decode(actual['indices']))==out; checks+=2
 assert actual['palette']==b['palette'] and actual['transparentIndex']==b['transparentIndex']; checks+=1
 image=Image.open(p/c['png']); assert image.tobytes()==bytes(out); assert image.convert('RGBA').tobytes()==bytes(v for i in out for v in b['palette'][i]); checks+=2
 png=(p/c['png']).read_bytes(); at=8; chunks={}
 while at<len(png):
  n=struct.unpack('>I',png[at:at+4])[0]; kind=png[at+4:at+8]; data=png[at+8:at+8+n]; assert zlib.crc32(kind+data)&0xffffffff==struct.unpack('>I',png[at+8+n:at+12+n])[0]; chunks.setdefault(kind,b''); chunks[kind]+=data; at+=n+12
 assert chunks[b'PLTE']==bytes(v for entry in b['palette'] for v in entry[:3]); assert chunks[b'tRNS']==bytes(entry[3] for entry in b['palette']); rows=zlib.decompress(chunks[b'IDAT']); assert bytes(v for y in range(oh) for v in rows[y*(ow+1)+1:(y+1)*(ow+1)])==bytes(out); checks+=3
 project=c['project']; assert [project['width'],project['height']]==[ow,oh] and project['version']==16; assert project['indexed']['palette']==b['palette']; assert base64.b64decode(project['layers'][0]['cels'][0]['indices'])==bytes(out); assert project['layers'][0]['cels'][1]['link']=='frame-1'; checks+=4
result={'status':'passed','version':m['version'],'checks':checks,'fixtures':len(m['cases']),'reader':'Python integer mapping, base64, PNG CRC/zlib and Pillow','completedAt':datetime.now(timezone.utc).isoformat()}; (p/'result.json').write_text(json.dumps(result,indent=2)); print('PASS independent indexed selection/geometry',json.dumps(result))
