import base64,json,struct,sys,zlib
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image

def mask_for(src,w,h,r,method):
 rw,rh=r['width'],r['height']; crop=[src[(r['y']+y)*w+r['x']+x] for y in range(rh) for x in range(rw)]
 if method=='ellipse': return [int((2*x+1-rw)**2*rh**2+(2*y+1-rh)**2*rw**2<=rw**2*rh**2) for y in range(rh) for x in range(rw)]
 if method=='diamond': return [int(abs(2*x+1-rw)*rh+abs(2*y+1-rh)*rw<=rw*rh) for y in range(rh) for x in range(rw)]
 if method=='subtract': return [int(not(1<=x<3 and y==1)) for y in range(rh) for x in range(rw)]
 if method=='lasso': return [int(2*x+3*y<=6) for y in range(rh) for x in range(rw)]
 if method=='empty': return [0]*(rw*rh)
 matches=[int(v==crop[0]) for v in crop]
 if method=='global': return matches
 out=[0]*len(crop); todo=[0]; out[0]=1
 for i in todo:
  x,y=i%rw,i//rw
  for dy in [-1,0,1]:
   for dx in [-1,0,1]:
    if (dx or dy) and 0<=x+dx<rw and 0<=y+dy<rh:
     j=(y+dy)*rw+x+dx
     if matches[j] and not out[j]: out[j]=1;todo.append(j)
 return out

def permute(src,w,h,ow,oh,rot=0,fx=False,fy=False):
 rw,rh=(h,w) if rot in [90,270] else (w,h); out=[]
 for y in range(oh):
  for x in range(ow):
   rx=((2*(ow-1-x if fx else x)+1)*rw)//(2*ow); ry=((2*(oh-1-y if fy else y)+1)*rh)//(2*oh)
   sx,sy=(ry,h-1-rx) if rot==90 else (w-1-rx,h-1-ry) if rot==180 else (w-1-ry,rx) if rot==270 else (rx,ry); out.append(src[sy*w+sx])
 return out

def expected(src,w,h,r,method,o,transparent):
 mask=mask_for(src,w,h,r,method); rw,rh=r['width'],r['height']; out=src.copy()
 crop=[src[(r['y']+y)*w+r['x']+x] for y in range(rh) for x in range(rw)]
 if o['kind']=='selection':
  t=o['transform']; rot=t.get('rotation',0); tw=t.get('width',rh if rot in [90,270] else rw); th=t.get('height',rw if rot in [90,270] else rh)
  members=permute(mask,rw,rh,tw,th,rot,t['flipX'],t['flipY']); pixels=permute(crop,rw,rh,tw,th,rot,t['flipX'],t['flipY'])
  if not t['copy']:
   for y in range(rh):
    for x in range(rw):
     if mask[y*rw+x]: out[(r['y']+y)*w+r['x']+x]=transparent
  for y in range(th):
   for x in range(tw):
    if members[y*tw+x]: out[(t['y']+y)*w+t['x']+x]=pixels[y*tw+x]
 else:
  selected=mask.copy()
  if o['kind']=='stroke':
   # Erode one four-neighbour ring at a time, keeping the original inner band.
   inner=mask.copy()
   for step in range(o['thickness']): inner=[int(inner[y*rw+x] and x>0 and x+1<rw and y>0 and y+1<rh and inner[y*rw+x-1] and inner[y*rw+x+1] and inner[(y-1)*rw+x] and inner[(y+1)*rw+x]) for y in range(rh) for x in range(rw)]
   selected=[int(a and not b) for a,b in zip(mask,inner)]
  slot=transparent if o['kind']=='cut' else o['slot']
  for y in range(rh):
   for x in range(rw):
    if selected[y*rw+x]: out[(r['y']+y)*w+r['x']+x]=slot
 return mask,out

def main():
 p=Path(sys.argv[1]); m=json.loads((p/'cases.json').read_text()); checks=0
 for c in m['cases']:
  b=c['before']; w,h=b['width'],b['height']; src=list(base64.b64decode(b['indices'])); mask,out=expected(src,w,h,c['rect'],c['method'],c['operation'],b['transparentIndex'])
  actual=json.loads((p/c['raw']).read_text()); assert actual['palette']==b['palette'] and actual['transparentIndex']==b['transparentIndex']; assert [actual['width'],actual['height']]==[w,h]; assert list(base64.b64decode(actual['indices']))==out;checks+=3
  im=Image.open(p/c['png']); assert im.tobytes()==bytes(out); assert im.convert('RGBA').tobytes()==bytes(v for i in out for v in b['palette'][i]);checks+=2
  png=(p/c['png']).read_bytes();at=8;chunks={}
  while at<len(png):
   n=struct.unpack('>I',png[at:at+4])[0];kind=png[at+4:at+8];data=png[at+8:at+8+n];assert zlib.crc32(kind+data)&0xffffffff==struct.unpack('>I',png[at+8+n:at+12+n])[0];chunks.setdefault(kind,b'');chunks[kind]+=data;at+=n+12
  assert chunks[b'PLTE']==bytes(v for entry in b['palette'] for v in entry[:3]); assert chunks[b'tRNS']==bytes(entry[3] for entry in b['palette']); rows=zlib.decompress(chunks[b'IDAT']); assert bytes(v for y in range(h) for v in rows[y*(w+1)+1:(y+1)*(w+1)])==bytes(out);checks+=3
  project=c['project']; assert project['version']==16 and project['indexed']['palette']==b['palette']; assert base64.b64decode(project['layers'][0]['cels'][0]['indices'])==bytes(out); assert project['layers'][0]['cels'][1]['link']=='frame-1';checks+=3
  r=c['rect']; file=json.loads((p/c['file']).read_text()); crop=[src[(r['y']+y)*w+r['x']+x] if mask[y*r['width']+x] else b['transparentIndex'] for y in range(r['height']) for x in range(r['width'])]; assert file['palette']==b['palette'] and list(base64.b64decode(file['indices']))==crop;assert Image.open(p/c['mask']).convert('RGBA').tobytes()==bytes(v for a in mask for v in ([255,255,255,255] if a else [0,0,0,255]));checks+=2
 result={'status':'passed','version':m['version'],'checks':checks,'fixtures':len(m['cases']),'reader':'Independent Python slot flood, integer masks/transforms, erosion, PNG CRC/zlib, JSON/base64 and Pillow','completedAt':datetime.now(timezone.utc).isoformat()};(p/'result.json').write_text(json.dumps(result,indent=2));print('PASS independent indexed masks',json.dumps(result))
if __name__=='__main__':main()
