import json,sys,base64
from fractions import Fraction
cases=json.load(open(sys.argv[1],encoding='utf-8'))
def pixel_matrix(cel,w,h):
 b=base64.b64decode(cel);b=b or bytes(w*h*4)
 return [[list(b[(y*w+x)*4:(y*w+x+1)*4]) for x in range(w)] for y in range(h)]
def transform(m,o):
 a=o.get('rotation',0)
 for _ in range(a//90):m=[list(row) for row in zip(*m[::-1])]
 h,w=len(m),len(m[0]);nw,nh=o.get('width',w),o.get('height',h)
 # Independent rational center coordinates rounded to nearest with upward ties.
 ix=lambda j,old,new:int(Fraction((2*j+1)*old-new,2*new)+Fraction(1,2))
 m=[[m[ix(y,h,nh)][ix(x,w,nw)] for x in range(nw)] for y in range(nh)]
 if o.get('flipX'):m=[r[::-1] for r in m]
 if o.get('flipY'):m=m[::-1]
 return m
for c in cases:
 w,h=c['w'],c['h'];m=pixel_matrix(c['before'],w,h);o=c['options']
 if c['selection']:
  r=c['rect'];piece=[row[r['x']:r['x']+r['width']] for row in m[r['y']:r['y']+r['height']]];piece=transform(piece,o)
  if not o['copy']:
   for y in range(r['y'],r['y']+r['height']):
    for x in range(r['x'],r['x']+r['width']):m[y][x]=[0]*4
  for y,row in enumerate(piece):m[o['y']+y][o['x']:o['x']+len(row)]=row
 else:m=transform(m,o)
 raw=bytes(v for row in m for p in row for v in p)
 actual=base64.b64decode(c['after']) or bytes(len(raw))
 assert raw==actual,c['options']
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python matrix transpose/reversal and Fraction source-center nearest sampling; complete RGBA'}))
