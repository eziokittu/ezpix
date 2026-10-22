import json,sys,math
from fractions import Fraction as F
cases=json.load(open(sys.argv[1],encoding='utf-8'))
def rnd(x):return math.floor(x+F(1,2))
for case in cases:
 w,h=case['w'],case['h'];src=[case['source'][i:i+4] for i in range(0,len(case['source']),4)];o=case['options'];out=[p[:] for p in src]
 def sample(x,y):
  if o['wrap']:x%=w;y%=h
  return src[y*w+x] if 0<=x<w and 0<=y<h else [0]*4
 def over(dst,c):
  a=F(c[3],255);b=F(dst[3],255)*(1-a);total=a+b
  return [rnd((c[k]*a+dst[k]*b)/total) for k in range(3)]+[rnd(255*total)] if total else dst
 kind=o['kind']
 for y in range(h):
  for x in range(w):
   p=y*w+x
   if kind in ['offset','rotate','shear','perspective']:
    if kind=='offset':u,v=x-o['amount'],y-o['secondaryAmount']
    elif kind=='rotate':
     # Exact quarter-turn oracle, no trigonometry or engine raster code.
     X,Y=F(2*x-w+1,2),F(2*y-h+1,2);q=(o['amount']//90)%4;u,v=[(X,Y),(Y,-X),(-X,-Y),(-Y,X)][q];u+=F(w-1,2);v+=F(h-1,2)
    elif kind=='shear':
     a,b=F(o['amount'],100),F(o['secondaryAmount'],100);X,Y=F(2*x-w+1,2),F(2*y-h+1,2);u=(X-a*Y)/(1-a*b)+F(w-1,2);v=(Y-b*X)/(1-a*b)+F(h-1,2)
    else:
     # Independent rectangular projective subset uses exact rational resampling.
     a,b,_,d=o['points'];u=F((2*x+1-2*a['x'])*w,2*(b['x']-a['x']))-F(1,2);v=F((2*y+1-2*a['y'])*h,2*(d['y']-a['y']))-F(1,2)
    out[p]=sample(rnd(u),rnd(v))[:]
   elif kind=='gradient':
    a,b=o['points'][:2];dx,dy=b['x']-a['x'],b['y']-a['y'];t=max(F(0),min(F(1),F((x-a['x'])*dx+(y-a['y'])*dy,dx*dx+dy*dy)));A,B=o['color'],o['secondary'];alpha=A[3]*(1-t)+B[3]*t
    colour=[rnd((A[k]*A[3]*(1-t)+B[k]*B[3]*t)/alpha if alpha else A[k]*(1-t)+B[k]*t) for k in range(3)]+[rnd(alpha)];out[p]=over(src[p],colour) if o['over'] else colour
   elif kind=='shadow':
    alpha=rnd(F(sample(x-o['amount'],y-o['secondaryAmount'])[3]*o['color'][3],255));shadow=o['color'][:3]+[alpha] if alpha else [0]*4
    out[p]=over(shadow,src[p]) if alpha or src[p][3] else src[p][:]
   elif kind in ['outline','alpha']:
    if kind=='alpha' and o['variant']=='threshold':out[p][3]=255 if src[p][3]>=o['amount'] else 0;continue
    neighbours=[(sample(x+xx,y+yy),abs(xx)+abs(yy)) for yy in range(-o['radius'],o['radius']+1) for xx in range(-o['radius'],o['radius']+1) if abs(xx)+abs(yy)<=o['radius']];strong=max(neighbours,key=lambda v:(v[0][3],-v[1]));high=strong[0][3];low=min(v[0][3] for v in neighbours)
    if kind=='outline':
     if src[p][3]==0 and high:
      c=o['color'][:3]+[rnd(F(high*o['color'][3],255))];out[p]=over(src[p],c) if o['over'] else c
    elif o['variant']=='erode':out[p][3]=low
    else:
     if src[p][3]==0:out[p][:3]=strong[0][:3]
     out[p][3]=high
 expected=[v for p in out for v in p]
 if expected!=case['actual']:
  index=next(i for i,(a,b) in enumerate(zip(expected,case['actual'])) if a!=b);raise AssertionError((case['id'],index,expected[index:index+8],case['actual'][index:index+8]))
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python Fraction arithmetic, exact quarter turns and rectangular projective resampling'}))
