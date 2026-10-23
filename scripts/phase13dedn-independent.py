import json,sys,math
from fractions import Fraction as F
def rnd(v):return math.floor(v+F(1,2))
def rgba(data,w,x,y):return data[(y*w+x)*4:(y*w+x+1)*4]
def u32(v):return v&0xffffffff
def hash_value(x,y,k,seed):
 n=u32(seed^u32((x+1)*0x9e3779b1)^u32((y+1)*0x85ebca6b)^u32((k+1)*0xc2b2ae35))
 n=u32((n^(n>>16))*0x7feb352d)
 return u32(n^(n>>15))
def render(case):
 w,h,src,o=case['w'],case['h'],case['src'],case['o'];out=src[:];kind=o['kind'];variant=o['variant'];r=o['radius'];a=o['amount'];b=o['secondaryAmount']
 def sample(x,y):
  if o.get('wrap'):x%=w;y%=h
  else:x=max(0,min(w-1,x));y=max(0,min(h-1,y))
  return rgba(src,w,x,y)
 def avg(samples,current):
  alpha=sum(p[3] for p in samples)
  return [rnd(F(sum(p[k]*p[3] for p in samples),alpha)) if alpha else current[k] for k in range(3)]+[rnd(F(alpha,len(samples)))]
 for y in range(h):
  for x in range(w):
   i=(y*w+x)*4;p=src[i:i+4];q=p[:]
   if kind=='motion':q=avg([sample(x+rnd(F(a*t,r)),y+rnd(F(b*t,r))) for t in range(-r,r+1) if variant!='trailing' or t<=0],p)
   elif kind=='mosaic':
    ax,ay=x//r*r,y//r*r
    q=sample(ax,ay) if variant=='nearest' else avg([sample(xx,yy) for yy in range(ay,min(h,ay+r)) for xx in range(ax,min(w,ax+r))],p)
   elif kind=='posterize' and p[3]:
    quant=lambda v:rnd(F(rnd(F(v*(a-1),255))*255,a-1))
    if variant=='alpha':q[3]=quant(p[3])
    elif variant=='luma':q[:3]=[quant(rnd(F(54*p[0]+183*p[1]+19*p[2],256)))]*3
    else:q[:3]=[quant(v) for v in p[:3]]
   elif kind=='edges' and p[3]:
    for k in range(3):
     def v(dx,dy):
      c=sample(x+dx,y+dy);return rnd(F(c[k]*c[3],255))
     if variant=='sobel':
      gx=-v(-1,-1)+v(1,-1)-2*v(-1,0)+2*v(1,0)-v(-1,1)+v(1,1)
      gy=-v(-1,-1)-2*v(0,-1)-v(1,-1)+v(-1,1)+2*v(0,1)+v(1,1)
      result=math.hypot(gx,gy)
     elif variant=='emboss':result=128+v(1,1)-v(-1,-1)
     else:result=abs(4*v(0,0)-v(-1,0)-v(1,0)-v(0,-1)-v(0,1))
     q[k]=max(0,min(255,rnd(result*a/100)))
   elif kind=='noise' and p[3] and hash_value(x,y,0,o['seed'])%100<b:
    for k in range(3):
     n=hash_value(x,y,k+1 if variant=='rgb' else 1,o['seed'])
     delta=(a if n&1 else -a) if variant=='salt' else rnd((F(n,0xffffffff)*2-1)*a)
     q[k]=max(0,min(255,p[k]+delta))
   elif kind=='shear':
    # independent rational inverse with custom origin pivot and zero Y shear
    u=F(x)-F(a*y,100);left=math.floor(u);fx=u-left;alpha=F(0);rgb=[F(0)]*3
    for xx,weight in [(left,1-fx),(left+1,fx)]:
     c=sample(xx,y) if o['wrap'] or 0<=xx<w else [0,0,0,0]
     alpha+=c[3]*weight
     for k in range(3):rgb[k]+=c[k]*c[3]*weight
    q=[rnd(c/alpha) if alpha else 0 for c in rgb]+[rnd(alpha)]
    if not alpha:
     xx=rnd(u);c=sample(xx,y) if o['wrap'] or 0<=xx<w else [0,0,0,0];q[:3]=c[:3]
   out[i:i+4]=q
 return out
cases=json.load(open(sys.argv[1],encoding='utf8'))
for case in cases:case['expected']=render(case)
json.dump(cases,open(sys.argv[2],'w',encoding='utf8'))
