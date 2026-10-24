import base64, json, struct, sys, zlib
from pathlib import Path
from PIL import Image
p=Path(sys.argv[1]); manifest=json.loads((p/'cases.json').read_text()); checks=0
def line(a,b):
 x,y=a['x'],a['y']; dx=abs(b['x']-x); dy=-abs(b['y']-y); sx=1 if x<b['x'] else -1; sy=1 if y<b['y'] else -1; err=dx+dy; out=[]
 while True:
  out.append((x,y))
  if (x,y)==(b['x'],b['y']): return out
  e=2*err
  if e>=dy: err+=dy; x+=sx
  if e<=dx: err+=dx; y+=sy
for case in manifest['cases']:
 b=case['before']; w,h=b['width'],b['height']; src=list(base64.b64decode(b['indices'])); dst=src.copy(); palette=b['palette']; trans=b['transparentIndex']; o=case['operation']; action=o['action']
 if action=='stroke':
  brush=o['brush']; pts=[]
  for n,pt in enumerate(o['points']): pts+=line(o['points'][max(0,n-1)],pt)
  start=-((brush['size']-1)//2); seen=set(); matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
  for x,y in pts:
   for dy in range(start,start+brush['size']):
    for dx in range(start,start+brush['size']):
     xx,yy=x+dx,y+dy
     if not (0<=xx<w and 0<=yy<h): continue
     for px in ([xx,w-1-xx] if brush['mirrorX'] else [xx]):
      for py in ([yy,h-1-yy] if brush['mirrorY'] else [yy]):
       i=py*w+px
       if i in seen: continue
       seen.add(i)
       if o['erase']: dst[i]=trans
       elif brush['mode']=='dither': dst[i]=brush['slot'] if matrix[(py%4)*4+px%4]*100<brush['density']*16 else brush['secondary']
       elif brush['mode']=='shade':
        if src[i]!=trans: dst[i]=max(0,min(len(palette)-1,src[i]+brush['shadeSteps']))
       else: dst[i]=brush['slot']
 elif action=='flood':
  todo=[o['point']['y']*w+o['point']['x']]; target=src[todo[0]]; seen=set()
  while todo:
   i=todo.pop()
   if i in seen or src[i]!=target: continue
   seen.add(i); dst[i]=o['slot']; x,y=i%w,i//w
   todo += [ny*w+nx for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)] if 0<=nx<w and 0<=ny<h]
 elif action=='shape':
  a,z=o['a'],o['b']; x0,x1=sorted([a['x'],z['x']]); y0,y1=sorted([a['y'],z['y']]); rw,rh=x1-x0+1,y1-y0+1
  def inside(x,y): return x0<=x<=x1 and y0<=y<=y1 and (o['shape']=='Rectangle' or ((2*x-2*x0-rw+1)/rw)**2+((2*y-2*y0-rh+1)/rh)**2<=1)
  if o['shape']=='Line': points=line(a,z)
  else: points=[(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1) if inside(x,y) and (o['filled'] or not all(inside(xx,yy) for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]))]
  for x,y in points: dst[y*w+x]=o['slot']
 elif action=='transform':
  for y in range(h):
   for x in range(w):
    t=o['transform']; sx=w-1-x if t in ['flip-x','rotate-180'] else x; sy=h-1-y if t in ['flip-y','rotate-180'] else y
    if t=='offset':
     sx,sy=x-o['x'],y-o['y']
     if o['wrap']: sx%=w; sy%=h
    dst[y*w+x]=src[sy*w+sx] if 0<=sx<w and 0<=sy<h else trans
 elif action in ['remove-slot','prune-slots']:
  order=[i for i in range(len(palette)) if (i!=o['slot'] if action=='remove-slot' else i in src or i==trans)]; dst=[order.index(i) for i in src]; palette=[palette[i] for i in order]; trans=order.index(trans) if trans in order else None
 actual=json.loads((p/case['json']).read_text()); assert list(base64.b64decode(actual['indices']))==dst; checks+=1
 assert actual['palette']==palette and actual['transparentIndex']==trans; checks+=1
 png=(p/case['png']).read_bytes(); at=8; chunks={}
 while at<len(png):
  n=struct.unpack('>I',png[at:at+4])[0]; typ=png[at+4:at+8]; data=png[at+8:at+8+n]; assert zlib.crc32(typ+data)&0xffffffff==struct.unpack('>I',png[at+8+n:at+12+n])[0]; chunks.setdefault(typ,[]).append(data); at+=n+12
 assert chunks[b'PLTE'][0]==bytes(v for c in palette for v in c[:3]); assert chunks[b'tRNS'][0]==bytes(c[3] for c in palette); checks+=2
 rows=zlib.decompress(b''.join(chunks[b'IDAT'])); assert bytes(v for y in range(h) for v in rows[y*(w+1)+1:(y+1)*(w+1)])==bytes(dst); checks+=1
 image=Image.open(p/case['png']); assert bytes(image.getdata())==bytes(dst); assert image.convert('RGBA').tobytes()==bytes(v for i in dst for v in palette[i]); checks+=2
 project=case['project']; cel=project['layers'][0]['cels'][0]; assert base64.b64decode(cel['indices'])==bytes(dst); assert project['indexed']['palette']==palette; assert project['layers'][0]['cels'][1]['link']=='frame-1'; checks+=3
def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
external=[]; palette=[[255,0,0,255],[11,12,13,0],[255,0,0,255],[0,0,255,128],[0,255,0,255]]; indices=[0,2,1,3,3,2,1,0]; w,h=4,2
for f in range(5):
 rows=bytearray()
 for y in range(h):
  rows.append(f)
  for x in range(w):
   i=y*w+x; a=indices[i-1] if x else 0; b=indices[i-w] if y else 0; c=indices[i-w-1] if x and y else 0; n=a+b-c; distances=[abs(n-a),abs(n-b),abs(n-c)]; paeth=[a,b,c][distances.index(min(distances))]; predictor=[0,a,b,(a+b)//2,paeth][f]; rows.append((indices[i]-predictor)&255)
 compressed=zlib.compress(rows); split=len(compressed)//2; png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,3,0,0,0))+chunk(b'PLTE',bytes(v for c in palette for v in c[:3]))+chunk(b'tRNS',bytes(c[3] for c in palette))+chunk(b'IDAT',compressed[:split])+chunk(b'IDAT',compressed[split:])+chunk(b'IEND',b''); filename=f'external-filter-{f}.png'; (p/filename).write_bytes(png); external.append({'file':filename,'expected':{'format':'ezpix-indexed-cel','version':1,'width':w,'height':h,'palette':palette,'transparentIndex':1,'indices':base64.b64encode(bytes(indices)).decode()}})
(p/'external.json').write_text(json.dumps(external)); (p/'readers.json').write_text(json.dumps({'status':'passed','version':manifest['version'],'checks':checks,'fixtures':len(manifest['cases']),'reader':'Python standard library plus Pillow','completedAt':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()})); print('PASS independent readers',checks)
