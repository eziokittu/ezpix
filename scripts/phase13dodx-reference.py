import json,sys,math
from fractions import Fraction as F
def rnd(v):return math.floor(v+F(1,2))
def solve(points,w,h):
 m=[]
 for (x,y),(u,v) in zip(points,[(0,0),(w,0),(w,h),(0,h)]):m.extend([[F(x),F(y),F(1),F(0),F(0),F(0),F(-u*x),F(-u*y),F(u)],[F(0),F(0),F(0),F(x),F(y),F(1),F(-v*x),F(-v*y),F(v)]])
 for col in range(8):
  pivot=next(i for i in range(col,8) if m[i][col]);m[col],m[pivot]=m[pivot],m[col];d=m[col][col];m[col]=[v/d for v in m[col]]
  for i in range(8):
   if i!=col:
    d=m[i][col];m[i]=[v-d*q for v,q in zip(m[i],m[col])]
 return [row[-1] for row in m]
def render(case):
 w,h,mask,src=case['w'],case['h'],case['mask'],case['src'];out=src[:];o=case['options'];kind=case['kind']
 if kind=='edit':
  if o['kind']=='feather':
   r=o['radius'];return [rnd(F(sum(mask[yy*w+xx] for yy in range(max(0,y-r),min(h,y+r+1)) for xx in range(max(0,x-r),min(w,x+r+1))),(2*r+1)**2)) for y in range(h) for x in range(w)]
  b=o['operand']['values'];return [max(a,b[i]) if o['kind']=='union' else min(a,b[i]) if o['kind']=='intersect' else max(0,a-b[i]) if o['kind']=='subtract' else abs(a-b[i]) if o['kind']=='xor' else b[i] for i,a in enumerate(mask)]
 if o['kind'] in ['fill','erase','alpha']:
  for i,weight in enumerate(mask):
   j=i*4;dst=src[j:j+4]
   if o['kind']=='erase':out[j+3]=rnd(F(dst[3]*(255-weight),255));continue
   paint=o['color'] if o['kind']=='fill' else dst[:3]+[min(255,rnd(F(dst[3]*o['percent'],100)))]
   a=dst[3]*(255-weight)+paint[3]*weight
   out[j:j+4]=[rnd(F(dst[k]*dst[3]*(255-weight)+paint[k]*paint[3]*weight,a)) if a else rnd(F(dst[k]*(255-weight)+paint[k]*weight,255)) for k in range(3)]+[rnd(F(a,255))]
  return out
 t=o['transform'];is_pers=t['kind']=='perspective';nonzero=[i for i,v in enumerate(mask) if v];bx=min(i%w for i in nonzero);by=min(i//w for i in nonzero);bw=max(i%w for i in nonzero)-bx+1;bh=max(i//w for i in nonzero)-by+1
 if is_pers:H=solve([(p['x'],p['y']) for p in t['points']],bw,bh)
 else:
  if not t['degrees'] and t['scaleX']==100 and t['scaleY']==100 and not t['shearX'] and not t['shearY'] and not t['x'] and not t['y']:return src
 if not t['copy']:
  for i,v in enumerate(mask):
   if v==255:out[i*4:i*4+4]=[0]*4
   else:out[i*4+3]=rnd(F(src[i*4+3]*(255-v),255))
 for y in range(h):
  for x in range(w):
   if is_pers:
    X,Y=F(2*x+1,2),F(2*y+1,2);sides=[(t['points'][(i+1)%4]['x']-a['x'])*(Y-a['y'])-(t['points'][(i+1)%4]['y']-a['y'])*(X-a['x']) for i,a in enumerate(t['points'])]
    if any(s>0 for s in sides) and any(s<0 for s in sides):continue
    den=H[6]*X+H[7]*Y+1
    if not den:continue
    u=(H[0]*X+H[1]*Y+H[2])/den-F(1,2)+bx;v=(H[3]*X+H[4]*Y+H[5])/den-F(1,2)+by
   else:
    cos,sin=([1,0,-1,0][t['degrees']//90%4],[0,1,0,-1][t['degrees']//90%4]);X=x-t['x']-t['pivot']['x'];Y=y-t['y']-t['pivot']['y'];rx=cos*X+sin*Y;ry=-sin*X+cos*Y;sx,sy=F(t['shearX'],100),F(t['shearY'],100);det=1-sx*sy;u=(rx-sx*ry)/det*F(100,t['scaleX'])+t['pivot']['x'];v=(ry-sy*rx)/det*F(100,t['scaleY'])+t['pivot']['y']
   if t['sampling']=='nearest':taps=[(rnd(u),rnd(v),F(1))]
   else:
    left,top=math.floor(u),math.floor(v);fx,fy=u-left,v-top;taps=[(left,top,(1-fx)*(1-fy)),(left+1,top,fx*(1-fy)),(left,top+1,(1-fx)*fy),(left+1,top+1,fx*fy)]
   coverage=F(0);alpha=F(0);rgb=[F(0)]*3;hidden=[F(0)]*3
   for xx,yy,weight in taps:
    if not (0<=xx<w and 0<=yy<h):continue
    j=yy*w+xx;cv=F(mask[j],255)*weight;coverage+=cv;alpha+=src[j*4+3]*cv
    for k in range(3):rgb[k]+=src[j*4+k]*src[j*4+3]*cv;hidden[k]+=src[j*4+k]*cv
   if not coverage:continue
   i=(y*w+x)*4;da=out[i+3]*(1-coverage);a=da+alpha
   out[i:i+4]=[rnd((out[i+k]*da+rgb[k])/a) if a else rnd(out[i+k]*(1-coverage)+hidden[k]) for k in range(3)]+[rnd(a)]
 return out
cases=json.load(open(sys.argv[1],encoding='utf8'))
for case in cases:case['expected']=render(case)
json.dump(cases,open(sys.argv[2],'w',encoding='utf8'))
