import json,sys,base64
from fractions import Fraction as F
cases=json.load(open(sys.argv[1],encoding='utf-8'))
def shape(kind,w,h):
 return [[int((F(2*x+1-w,w)**2+F(2*y+1-h,h)**2<=1) if kind=='ellipse' else (abs(F(2*x+1-w,w))+abs(F(2*y+1-h,h))<=1)) for x in range(w)] for y in range(h)]
for c in cases:
 r=c['rect'];w,h=r['width'],r['height'];src=shape(c['baseKind'],w,h);op=c['operation'];k=op['kind'];mask=[]
 def at(x,y):return src[y][x] if 0<=x<w and 0<=y<h else 0
 for y in range(h):
  row=[]
  for x in range(w):
   a=at(x,y);neighbours=[at(x-1,y),at(x+1,y),at(x,y-1),at(x,y+1)]
   if k=='ellipse':v=int(F(2*x+1-w,w)**2+F(2*y+1-h,h)**2<=1)
   elif k=='diamond':v=int(abs(F(2*x+1-w,w))+abs(F(2*y+1-h,h))<=1)
   elif k=='invert':v=1-a
   elif k=='grow':v=int(a or any(neighbours))
   elif k=='shrink':v=int(a and all(neighbours))
   elif k=='border':v=int(a and not all(neighbours))
   else:
    q=op['rect'];b=q['x']<=x<q['x']+q['width'] and q['y']<=y<q['y']+q['height'];v=int((a or b) if k=='union' else (a and not b) if k=='subtract' else (a and b) if k=='intersect' else bool(a)!=b)
   row.append(v)
  mask.append(row)
 assert bytes(v for row in mask for v in row)==base64.b64decode(c['mask']),op
 before=base64.b64decode(c['before']);out=bytearray(before);o=c['options'];cw=c['w']
 if not o['copy']:
  for y in range(h):
   for x in range(w):
    if mask[y][x]:i=((y+r['y'])*cw+x+r['x'])*4;out[i:i+4]=bytes(4)
 # Independent forward quarter turns, row/column matrix operations, then sampling.
 matrix=[[(mask[y][x],before[((y+r['y'])*cw+x+r['x'])*4:((y+r['y'])*cw+x+r['x'])*4+4]) for x in range(w)] for y in range(h)]
 for _ in range(o['rotation']//90):matrix=[list(row) for row in zip(*matrix[::-1])]
 rh,rw=len(matrix),len(matrix[0]);ow,oh=o['width'],o['height'];scaled=[[matrix[int(F(2*y+1,2)*rh/oh)][int(F(2*x+1,2)*rw/ow)] for x in range(ow)] for y in range(oh)]
 if o['flipX']:scaled=[row[::-1] for row in scaled]
 if o['flipY']:scaled=scaled[::-1]
 assert bytes(p[0] for row in scaled for p in row)==base64.b64decode(c['transformedMask']),op
 for y,row in enumerate(scaled):
  for x,(selected,pixel) in enumerate(row):
   if selected:i=((y+o['y'])*cw+x+o['x'])*4;out[i:i+4]=pixel
 assert bytes(out)==base64.b64decode(c['after']),op
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python Fraction shape edges, simultaneous set algebra, forward matrix rotations and complete raw RGBA comparisons'}))
