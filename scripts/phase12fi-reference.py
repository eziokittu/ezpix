import json,sys,math
from fractions import Fraction
from bisect import bisect_right
B=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
def lut(points):
 xs=[p['input'] for p in points];out=[]
 for x in range(256):
  k=min(len(points)-2,max(0,bisect_right(xs,x)-1));a,b=points[k:k+2]
  value=Fraction(a['output']*(b['input']-x)+b['output']*(x-a['input']),b['input']-a['input'])
  out.append(math.floor(value+Fraction(1,2)))
 return out
def ramp(o):
 a=bytes.fromhex(o['from'][1:]);b=bytes.fromhex(o['to'][1:]);n=o['steps']-1
 return ['#'+''.join(f'{math.floor(Fraction(a[k]*(n-i)+b[k]*i,n)+Fraction(1,2)):02x}' for k in range(3)) for i in range(n+1)]
data=json.load(open(sys.argv[1]));result=[]
for item in data:
 o=item['options']
 if o['kind']=='ramp': result.append(ramp(o));continue
 pixels=item['pixels'][:]
 if o['kind']=='curves':
  master=lut(o['points']);tables=[lut(o['channels'][k]) for k in ['red','green','blue']]
  for i in range(0,len(pixels),4):
   if pixels[i+3]:pixels[i:i+3]=[tables[k][master[pixels[i+k]]] for k in range(3)]
 elif o['kind'] in ('dither','legacy-converter'):
  colors=[tuple(bytes.fromhex(c[1:])) for c in o['colors']]
  for i in range(0,len(pixels),4):
   rgb=tuple(pixels[i:i+3]);alpha=pixels[i+3]
   if not alpha:
    if o['kind']=='legacy-converter':pixels[i:i+4]=[0,0,0,0]
    continue
   if o['kind']=='dither' and rgb in colors:continue
   x=i//4%item['width'];y=i//4//item['width']
   # Fractions deliberately differ from runtime scaled integer arithmetic.
   offset=Fraction((2*B[(y%4)*4+x%4]-15)*o['strength'],50)
   best=min(enumerate(colors),key=lambda pair:(sum((Fraction(rgb[k])+offset-pair[1][k])**2 for k in range(3)),pair[0]))[1]
   pixels[i:i+3]=best
 result.append(pixels)
json.dump(result,sys.stdout)
