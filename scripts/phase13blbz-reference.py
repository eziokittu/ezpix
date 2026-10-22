import sys,json,base64,collections,io
from fractions import Fraction
from PIL import Image
cases=json.load(open(sys.argv[1],encoding='utf-8'))
for c in cases:
 w,h=c['w'],c['h'];n=w*h;src=c['mask'];op=c['op'];kind=op['kind'];raw=base64.b64decode(c['raw']);out=[0]*n
 def adjacent(i,conn):
  x,y=i%w,i//w
  for dy in (-1,0,1):
   for dx in (-1,0,1):
    if (dx or dy) and (conn==8 or not dx or not dy) and 0<=x+dx<w and 0<=y+dy<h:yield (y+dy)*w+x+dx
 def groups(mask,conn):
  remaining={i for i,v in enumerate(mask) if v};result=[]
  while remaining:
   start=min(remaining);remaining.remove(start);q=[start];g=[]
   for i in q:
    g.append(i)
    for j in adjacent(i,conn):
     if j in remaining:remaining.remove(j);q.append(j)
   result.append(g)
  return result
 def morph(mask,grow,r,conn):
  # Independent repeated cellular dilation/erosion, unlike TS distance passes.
  for _ in range(r):
   next=[]
   for i in range(n):
    ns=list(adjacent(i,conn));vals=[mask[i]]+[mask[j] for j in ns]
    next.append(int(any(vals) if grow else len(ns)==(8 if conn==8 else 4) and all(vals)))
   mask=next
  return mask
 if kind in ('wand','colour'):
  seed=op['seed']['y']*w+op['seed']['x'];channels=4 if op['channels']=='rgba' else 3
  matches=[all(abs(raw[i*4+k]-raw[seed*4+k])<=op['tolerance'] for k in range(channels)) for i in range(n)]
  if kind=='colour':out=list(map(int,matches))
  else:
   q=[seed];seen={seed}
   for i in q:
    out[i]=1
    for j in adjacent(i,op['connectivity']):
     if j not in seen:
      seen.add(j)
      if matches[j]:q.append(j)
 elif kind=='alpha':out=[int(op['min']<=raw[i*4+3]<=op['max']) for i in range(n)]
 elif kind in ('polygon','lasso'):
  points=op['points']
  for y in range(h):
   for x in range(w):
    inside=False;boundary=False
    for a,b in zip(points,points[1:]+points[:1]):
     cross=(x-a['x'])*(b['y']-a['y'])-(y-a['y'])*(b['x']-a['x'])
     if cross==0 and min(a['x'],b['x'])<=x<=max(a['x'],b['x']) and min(a['y'],b['y'])<=y<=max(a['y'],b['y']):boundary=True;break
     if (a['y']>y)!=(b['y']>y) and x<Fraction((b['x']-a['x'])*(y-a['y']),b['y']-a['y'])+a['x']:inside=not inside
    out[y*w+x]=int(inside or boundary)
 elif kind=='shape':
  for y in range(op['y'],op['y']+op['height']):
   for x in range(op['x'],op['x']+op['width']):
    a=Fraction(2*(x-op['x'])+1-op['width'],op['width']);b=Fraction(2*(y-op['y'])+1-op['height'],op['height'])
    out[y*w+x]=int(op['shape']=='rectangle' or (a*a+b*b<=1 if op['shape']=='ellipse' else abs(a)+abs(b)<=1))
 elif kind=='morphology':
  r=op['radius'];conn=op['connectivity'];mode=op['mode']
  if mode in ('grow','shrink'):out=morph(src,mode=='grow',r,conn)
  elif mode=='border':out=[int(a and not b) for a,b in zip(src,morph(src,False,r,conn))]
  elif mode=='open':out=morph(morph(src,False,r,conn),True,r,conn)
  else:out=morph(morph(src,True,r,conn),False,r,conn)
 elif kind=='holes':
  out=src[:]
  for g in groups([1-v for v in src],op['connectivity']):
   if all(i%w not in (0,w-1) and i//w not in (0,h-1) for i in g):
    for i in g:out[i]=1
 elif kind=='components':
  gs=groups(src,op['connectivity']);largest=max(gs,key=len,default=[]);seed=op['seed']['y']*w+op['seed']['x']
  for g in gs:
   if (g==largest if op['mode']=='largest' else seed in g if op['mode']=='seed' else op['min']<=len(g)<=op['max']):
    for i in g:out[i]=1
 elif kind=='brush':
  out=src[:];points=op['points'];stamps=[]
  # Sampling each unit segment with a separate error-based line oracle.
  for a,b in zip(points,points[1:] or points):
   x,y=a['x'],a['y'];dx=b['x']-x;dy=b['y']-y;steps=max(abs(dx),abs(dy))
   # Inputs here use horizontal/vertical/45deg strokes, for unambiguous independent line samples.
   stamps.extend((x+(0 if not steps else j*dx//steps),y+(0 if not steps else j*dy//steps)) for j in range(steps+1))
  if len(points)==1:stamps=[(points[0]['x'],points[0]['y'])]
  size=op['size'];lo=-((size-1)//2);hi=lo+size-1
  for x,y in stamps:
   for sy in range(h):
    for sx in range(w):
     a,b=sx-x,sy-y
     if lo<=a<=hi and lo<=b<=hi and (op['shape']=='square' or (2*a-lo-hi)**2+(2*b-lo-hi)**2<=size*size):out[sy*w+sx]=int(not op['erase'])
 combine=c['combine']
 result=[b if combine=='replace' else int(a or b) if combine=='union' else int(a and not b) if combine=='subtract' else int(a and b) if combine=='intersect' else a^b for a,b in zip(src,out)]
 assert result==c['result'],(kind,op,combine,w,h)
 if 'png' in c:
  im=Image.open(io.BytesIO(base64.b64decode(c['png']))).convert('RGBA');assert im.size==(w,h);assert list(im.tobytes())==[v for bit in result for v in (bit*255,bit*255,bit*255,255)]
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python BFS, repeated cellular morphology, Fraction polygons/shapes, independent brush samples and Pillow mask PNG'}))
