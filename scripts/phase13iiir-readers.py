"""Independent index math, integer path geometry, PNG chunks and v16 project reader."""
import json,base64,struct,zlib,sys
from pathlib import Path
BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
def cel(project,layer=0,frame=0):
 c=project['layers'][layer]['cels'][frame]
 if 'link' in c:return cel(project,layer,next(i for i,f in enumerate(project['frames']) if f['id']==c['link']))
 if c.get('empty'):return [project['indexed']['transparentIndex']]*(project['width']*project['height'])
 return list(base64.b64decode(c['indices']))
def anchors(points,options):
 filtered=[];window=[]
 for p in points:
  window.append(p)
  if len(window)>options['stabilization']+1:window.pop(0)
  q=(int(sum(p['x'] for p in window)/len(window)+.5),int(sum(p['y'] for p in window)/len(window)+.5))
  if not filtered or q!=filtered[-1]:filtered.append(q)
 connected=[]
 for j,b in enumerate(filtered):
  a=filtered[max(0,j-1)];x,y=a;dx=abs(b[0]-x);dy=-abs(b[1]-y);sx=1 if x<b[0] else -1;sy=1 if y<b[1] else -1;err=dx+dy
  while True:
   if not connected or connected[-1]!=(x,y):connected.append((x,y))
   if (x,y)==b:break
   e=2*err
   if e>=dy:err+=dy;x+=sx
   if e<=dx:err+=dx;y+=sy
 clean=[]
 for p in connected:
  if options['pixelPerfect'] and len(clean)>=2:
   a,b=clean[-2:]
   if abs(a[0]-b[0])+abs(a[1]-b[1])==1 and abs(b[0]-p[0])+abs(b[1]-p[1])==1 and abs(a[0]-p[0])==1 and abs(a[1]-p[1])==1:clean.pop()
  clean.append(p)
 return [p for i,p in enumerate(clean) if i%options['spacing']==0 or i==len(clean)-1]
def mix(i,seed):
 n=(((i+1)*0x9e3779b1)&0xffffffff)^seed;n=((n^(n>>16))*0x7feb352d)&0xffffffff;n=((n^(n>>15))*0x846ca68b)&0xffffffff;return (n^(n>>16))&0xffffffff
def expected(project,o):
 w,h=project['width'],project['height'];palette=project['indexed']['palette'];transparent=project['indexed']['transparentIndex'];before=cel(project);out=before[:]
 if o['action']=='flood':
  p=o['point'];target=before[p['y']*w+p['x']];dest=o['slot']
  if target==dest:return out
  if o.get('global'):
   return [dest if v==target else v for v in before]
  queue=[p['y']*w+p['x']];visited=set(queue)
  for i in queue:
   out[i]=dest;x,y=i%w,i//w
   for dy in range(-1,2):
    for dx in range(-1,2):
     if not (dx or dy) or o.get('connectivity',4)==4 and dx and dy:continue
     nx,ny=x+dx,y+dy;n=ny*w+nx
     if 0<=nx<w and 0<=ny<h and n not in visited and before[n]==target:visited.add(n);queue.append(n)
  return out
 b=o['brush'];stamp=b.get('stamp') if b['mode']=='stamp' else None
 if stamp:offsets=[(i%stamp['width']-(stamp['width']-1)//2,i//stamp['width']-(stamp['height']-1)//2,i) for i in range(stamp['width']*stamp['height'])]
 else:
  start=-((b['size']-1)//2);offsets=[]
  for y in range(b['size']):
   for x in range(b['size']):
    dx,dy=x+start,y+start
    if b['shape']=='square' or (2*x-(b['size']-1))**2+(2*y-(b['size']-1))**2<=b['size']**2:offsets.append((dx,dy,0))
 visited=set()
 for ax,ay in anchors(o['points'],b):
  for dx,dy,si in offsets:
   if stamp and not b.get('stampTransparent') and stamp['indices'][si]==stamp['transparentIndex']:continue
   x,y=ax+dx,ay+dy
   if b['wrapX']:x%=w
   if b['wrapY']:y%=h
   if not (0<=x<w and 0<=y<h):continue
   for px in [x,w-1-x] if b['mirrorX'] else [x]:
    for py in [y,h-1-y] if b['mirrorY'] else [y]:
     i=py*w+px
     if i in visited:continue
     visited.add(i);old=before[i]
     if b['alphaLock'] and old==transparent:continue
     mode=b['mode']
     if mode=='spray' and mix(i,b.get('seed',1))%100>=b['density']:continue
     if o['erase']:value=transparent
     elif stamp:value=stamp['indices'][si]
     elif mode=='replace':
      if old!=b['replaceSlot']:continue
      value=b['slot']
     elif mode=='ramp':
      if old not in b['ramp']:continue
      at=b['ramp'].index(old)+b['shadeSteps'];at=at%len(b['ramp']) if b.get('rampWrap') else max(0,min(len(b['ramp'])-1,at));value=b['ramp'][at]
     elif mode=='dither':value=b['slot'] if BAYER[(py-b.get('originY',0))%4*4+(px-b.get('originX',0))%4]*100<b['density']*16 else b['secondary']
     elif mode=='shade':
      if old==transparent:continue
      value=max(0,min(len(palette)-1,old+b['shadeSteps']))
     else:value=b['slot']
     if b['alphaLock'] and palette[value][3]!=palette[old][3]:continue
     out[i]=value
 return out

def png(path,w,h,palette,indices):
 b=path.read_bytes();assert b[:8]==bytes([137,80,78,71,13,10,26,10]);at=8;chunks={}
 while at<len(b):
  n=struct.unpack_from('>I',b,at)[0];t=b[at+4:at+8];p=b[at+8:at+8+n];assert zlib.crc32(t+p)&0xffffffff==struct.unpack_from('>I',b,at+8+n)[0];chunks.setdefault(t,bytearray()).extend(p);at+=n+12
 assert at==len(b);assert struct.unpack('>IIBBBBB',chunks[b'IHDR'])==(w,h,8,3,0,0,0)
 assert list(chunks[b'PLTE'])==[v for p in palette for v in p[:3]];assert list(chunks[b'tRNS'])==[p[3] for p in palette]
 raw=zlib.decompress(chunks[b'IDAT']);assert len(raw)==(w+1)*h;assert all(raw[y*(w+1)]==0 for y in range(h));assert [raw[y*(w+1)+x+1] for y in range(h) for x in range(w)]==indices

def main():
 out=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/phase13iiir-independent');manifest=json.loads((out/'cases.json').read_text());checks=0
 for c in manifest['cases']:
  before=c['before'];want=expected(before,c['operation']);raw=json.loads((out/c['raw']).read_text());after=json.loads((out/c['project']).read_text());w,h=before['width'],before['height'];palette=before['indexed']['palette']
  assert list(base64.b64decode(raw['indices']))==want;checks+=1
  assert raw['palette']==palette and raw['transparentIndex']==before['indexed']['transparentIndex'];checks+=1
  assert cel(after)==want and cel(after,0,1)==want;checks+=2
  assert after['layers'][0]['cels'][1]['link']=='frame-1';checks+=1
  assert cel(after,0,2)==cel(before,0,2);checks+=1
  for f in range(3):assert cel(after,1,f)==cel(before,1,f);checks+=1
  assert after['indexed']==before['indexed'];checks+=1
  assert after['layers'][1]['visible']==False and after['frames']==before['frames'];checks+=1
  png(out/c['png'],w,h,palette,want);checks+=4
 result=dict(status='passed',version=manifest['version'],fixtures=len(manifest['cases']),checks=checks,reader='Independent Python integer paths, slot inks, hash, flood, PNG CRC/zlib and JSON/base64');(out/'result.json').write_text(json.dumps(result,indent=2));print('PASS indexed ink fixtures',result)
if __name__=='__main__':main()
