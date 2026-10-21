import json,sys,colorsys
from fractions import Fraction as F
from functools import cmp_to_key
# Rational HLS implementation with independently expressed inverse hue interpolation.
def parse(c): return tuple(int(c[k:k+2],16) for k in (1,3,5))
def hls(rgb):
 r,g,b=[F(v,255) for v in rgb];hi=max(r,g,b);lo=min(r,g,b);l=(hi+lo)/2;delta=hi-lo
 if not delta:return F(0),l,F(0)
 s=delta/(hi+lo) if l<=F(1,2) else delta/(2-hi-lo)
 h=((g-b)/delta if hi==r else (b-r)/delta+2 if hi==g else (r-g)/delta+4)/6
 return h%1,l,s
def inverse(h,l,s):
 if not s:return [l]*3
 q=l*(1+s) if l<F(1,2) else l+s-l*s;p=2*l-q
 def f(t):
  t=t%1
  if t<F(1,6):return p+(q-p)*6*t
  if t<F(1,2):return q
  if t<F(2,3):return p+(q-p)*(F(2,3)-t)*6
  return p
 return [f(h+F(1,3)),f(h),f(h-F(1,3))]
def harmony(o):
 base=o['base'].lower();h,l,s=hls(parse(base));offsets={'complementary':[0,180],'analogous':[0,-30,30],'triadic':[0,120,240]}[o['mode']];result=[]
 for angle in offsets:
  values=inverse(h+F(angle,360),l,s);result.append('#'+''.join(f'{int(v*255+F(1,2)):02x}' for v in values))
 return result
def order(study):
 o=study['options'];indexed=list(enumerate(study['colors']))
 def key(item):
  rgb=parse(item[1]);return hls(rgb)[0] if o['by']=='hue' else max(rgb) if o['by']=='brightness' else int(item[1][1:],16)
 # Python stable reverse sorting retains tie order, matching the contract.
 return [color for _,color in sorted(indexed,key=key,reverse=o['direction']=='descending')]
data=json.load(open(sys.argv[1]));json.dump([harmony(x['options']) if x['options']['kind']=='harmony' else order(x) for x in data],sys.stdout)
