"""Independent index math, integer path geometry, PNG chunks and v16 project reader."""
import json,base64,struct,zlib,sys
from pathlib import Path
BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
def cel(project,layer=0,frame=0):
 c=project['layers'][layer]['cels'][frame]
 if 'link' in c:return cel(project,layer,next(i for i,f in enumerate(project['frames']) if f['id']==c['link']))
 if c.get('empty'):return [project['indexed']['transparentIndex']]*(project['width']*project['height'])
 return list(base64.b64decode(c['indices']))
def mix(i,seed):
 n=(((i+1)*0x9e3779b1)&0xffffffff)^seed;n=((n^(n>>16))*0x7feb352d)&0xffffffff;n=((n^(n>>15))*0x846ca68b)&0xffffffff;return (n^(n>>16))&0xffffffff
def expected(project,o):
 import math
 w,h=project['width'],project['height'];b=o['brush'];settings=b['pressure'];source=cel(project);out=source[:];visited=set();points=o['points']
 if len(points)==1:path=points
 elif points[0]['x']==points[1]['x']:path=[points[-1]]
 else:
  a,z=points;distance=z['x']-a['x'];path=[dict(x=a['x']+i,y=a['y'],pressure=a['pressure']+(z['pressure']-a['pressure'])*i/distance) for i in range(distance+1)]
 for point in path:
  p=point.get('pressure',1);curve=settings['curve'];response=math.sqrt(p) if curve=='soft' else p*p if curve=='firm' else p;factor=(settings['minimum']+(100-settings['minimum'])*response)/100
  size=max(1,math.floor(b['size']*factor+.5)) if settings['size'] else b['size'];density=math.floor(b['density']*factor+.5) if settings['density'] else b['density'];start=-((size-1)//2);center=start+(size-1)/2;radius=max(.5,(size-.5)/2)
  for dy in range(start,start+size):
   for dx in range(start,start+size):
    if b['shape']=='circle' and (dx-center)**2+(dy-center)**2>radius**2:continue
    x,y=point['x']+dx,point['y']+dy
    if not(0<=x<w and 0<=y<h):continue
    i=y*w+x
    if i in visited:continue
    visited.add(i)
    if b['mode']=='spray' and mix(i,b['seed'])%100>=density:continue
    out[i]=b['slot'] if b['mode']!='dither' or BAYER[(y%4)*4+x%4]*100<density*16 else b['secondary']
 return out

def png(path,w,h,palette,indices):
 b=path.read_bytes();assert b[:8]==bytes([137,80,78,71,13,10,26,10]);at=8;chunks={}
 while at<len(b):
  n=struct.unpack_from('>I',b,at)[0];t=b[at+4:at+8];p=b[at+8:at+8+n];assert zlib.crc32(t+p)&0xffffffff==struct.unpack_from('>I',b,at+8+n)[0];chunks.setdefault(t,bytearray()).extend(p);at+=n+12
 assert at==len(b);assert struct.unpack('>IIBBBBB',chunks[b'IHDR'])==(w,h,8,3,0,0,0)
 assert list(chunks[b'PLTE'])==[v for p in palette for v in p[:3]];assert list(chunks[b'tRNS'])==[p[3] for p in palette]
 raw=zlib.decompress(chunks[b'IDAT']);assert len(raw)==(w+1)*h;assert all(raw[y*(w+1)]==0 for y in range(h));assert [raw[y*(w+1)+x+1] for y in range(h) for x in range(w)]==indices

def main():
 out=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/phase13isiv-independent');manifest=json.loads((out/'cases.json').read_text());checks=0
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
 result=dict(status='passed',version=manifest['version'],fixtures=len(manifest['cases']),checks=checks,reader='Independent Python pressure response, discrete footprints/density, PNG CRC/zlib and JSON/base64');(out/'result.json').write_text(json.dumps(result,indent=2));print('PASS indexed pressure fixtures',result)
if __name__=='__main__':main()
