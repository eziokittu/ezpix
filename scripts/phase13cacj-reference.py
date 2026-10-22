import json,sys,base64
from fractions import Fraction
cases=json.load(open(sys.argv[1],encoding='utf-8'))
def rnd(n,d=1):return (2*n+d)//(2*d)
def blend(dst,src,o):
 if o['alphaLock'] and dst[3]==0:return dst[:]
 if o['blend']=='replace':out=src[:]
 elif not src[3]:out=dst[:]
 else:
  a=Fraction(src[3],255);b=Fraction(dst[3],255);alpha=a+b*(1-a)
  out=[rnd((Fraction(src[k])*a+dst[k]*b*(1-a)).numerator*alpha.denominator,(Fraction(src[k])*a+dst[k]*b*(1-a)).denominator*alpha.numerator) for k in range(3)]+[rnd(alpha.numerator*255,alpha.denominator)]
 if o['alphaLock']:out[3]=dst[3]
 return out
def hash_value(x,y,a,seed):
 n=(seed^(((x+1)*0x9e3779b1)&0xffffffff)^(((y+1)*0x85ebca6b)&0xffffffff)^(((a+1)*0xc2b2ae35)&0xffffffff))&0xffffffff
 n=((n^(n>>16))*0x7feb352d)&0xffffffff;n=((n^(n>>15))*0x846ca68b)&0xffffffff
 return (n^(n>>16))&0xffffffff
def path_oracle(path,o):
 window=[];filtered=[]
 for p in path:
  window.append(p);window=window[-(o['stabilization']+1):];q={'x':rnd(sum(t['x'] for t in window),len(window)),'y':rnd(sum(t['y'] for t in window),len(window))}
  if not filtered or filtered[-1]!=q:filtered.append(q)
 connected=[]
 for a,b in zip([filtered[0]]+filtered[:-1],filtered):
  x,y=a['x'],a['y'];dx=abs(b['x']-x);dy=-abs(b['y']-y);sx=1 if x<b['x'] else -1;sy=1 if y<b['y'] else -1;err=dx+dy
  while True:
   p={'x':x,'y':y}
   if not connected or connected[-1]!=p:connected.append(p)
   if p==b:break
   e=2*err
   if e>=dy:err+=dy;x+=sx
   if e<=dx:err+=dx;y+=sy
 clean=[]
 for p in connected:
  if o['pixelPerfect'] and len(clean)>1:
   a,b=clean[-2:]
   if abs(a['x']-b['x'])+abs(a['y']-b['y'])==1 and abs(b['x']-p['x'])+abs(b['y']-p['y'])==1 and abs(a['x']-p['x'])==abs(a['y']-p['y'])==1:clean.pop()
  clean.append(p)
 return [p for i,p in enumerate(clean) if i%o['spacing']==0 or i==len(clean)-1]
for c in cases:
 w,h=c['w'],c['h'];o=c['options'];raw=list(base64.b64decode(c['before']));out=raw[:];anchors=path_oracle(c['path'],o);assert anchors==c['anchors'];visited=set();stamp=o.get('stamp');offsets=[]
 if stamp:
  sw,sh=stamp['width'],stamp['height']
  offsets=[(x-(sw-1)//2,y-(sh-1)//2,y*sw+x) for y in range(sh) for x in range(sw)]
 else:
  size=o['size'];lo=-((size-1)//2);center=Fraction(2*lo+size-1,2);radius=max(Fraction(1,2),Fraction(2*size-1,4))
  offsets=[(x,y,0) for y in range(lo,lo+size) for x in range(lo,lo+size) if o['shape']=='square' or (x-center)**2+(y-center)**2<=radius**2]
 def sample(x,y):
  x=x%w if o['wrapX'] else max(0,min(w-1,x));y=y%h if o['wrapY'] else max(0,min(h-1,y));i=(y*w+x)*4;return raw[i:i+4]
 # Generate Bayer rank by recurrence, independently of the TS literal.
 bayer=[[0]]
 for _ in range(2):
  n=len(bayer);bayer=[[4*bayer[y%n][x%n]+[[0,2],[3,1]][y//n][x//n] for x in range(2*n)] for y in range(2*n)]
 for a,p in enumerate(anchors):
  for dx,dy,si in offsets:
   x,y=p['x']+dx,p['y']+dy
   if o['wrapX']:x%=w
   if o['wrapY']:y%=h
   if not (0<=x<w and 0<=y<h):continue
   st=stamp['pixels'][si*4:si*4+4] if stamp else None
   if st and not o['stampTransparent'] and not st[3]:continue
   for px in ([x,w-1-x] if o['mirrorX'] else [x]):
    for py in ([y,h-1-y] if o['mirrorY'] else [y]):
     i=(py*w+px)*4
     if i in visited:continue
     if o['mode']=='spray' and hash_value(px,py,a,o['seed'])%100>=o['density']:continue
     visited.add(i);dst=raw[i:i+4];ink=o['primary'][:]
     if o['mode']=='dither':ink=(o['primary'] if bayer[py%4][px%4]*100<o['density']*16 else o['secondary'])[:]
     if st:
      if o['stampMode']=='rgba':ink=st[:]
      else:ink[3]=rnd(ink[3]*st[3],255)
     if o['mode']=='shade':
      if not dst[3] or not o['shadeSteps']:continue
      palette=[list(bytes.fromhex(v[1:])) for v in c['palette']];best=min(range(len(palette)),key=lambda j:sum((palette[j][k]-dst[k])**2 for k in range(3)));ink=palette[max(0,min(len(palette)-1,best+o['shadeSteps']))]+[dst[3]]
     if o['mode']=='blur':
      ns=[sample(px+x,py+y) for y in (-1,0,1) for x in (-1,0,1)];a_sum=sum(v[3] for v in ns);ink=[rnd(sum(v[k]*v[3] for v in ns),a_sum) if a_sum else dst[k] for k in range(3)]+[rnd(a_sum,9)]
     if o['mode']=='sharpen':
      ns=[sample(px-1,py),sample(px+1,py),sample(px,py-1),sample(px,py+1)];ink=[max(0,min(255,5*dst[k]-sum(v[k] for v in ns))) for k in range(3)]+[dst[3]]
     result=blend(dst,ink,o)
     if o['mode'] in ('shade','sharpen'):result[3]=dst[3]
     out[i:i+4]=result
 assert out==list(base64.b64decode(c['result'])),(o['mode'],c['trial'])
 assert sum(raw[i:i+4]!=out[i:i+4] for i in range(0,len(raw),4))==c['changed']
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python Fraction source-over/filter/stamp arithmetic, generated Bayer matrix, independent path and deterministic integer hash'}))
