import json,sys,base64
from fractions import Fraction as F
from collections import deque
cases=json.load(open(sys.argv[1],encoding='utf-8'));base=[[0,2],[3,1]];bayer=[[4*base[y%2][x%2]+base[y//2][x//2] for x in range(4)] for y in range(4)]
def nearest(q):return (q+F(1,2)).numerator//(q+F(1,2)).denominator
for c in cases:
 w,h=c['w'],c['h'];r,o=c['rect'],c['options'];before=base64.b64decode(c['before']) or bytes(w*h*4);out=bytearray(before);changed=0;mask=base64.b64decode(c['mask']);mw,mh=r['width'],r['height'];distance=[mw+mh]*len(mask);q=deque()
 for p,v in enumerate(mask):
  if not v:distance[p]=0;q.append(p)
 for p,v in enumerate(mask):
  x,y=p%mw,p//mw
  if v and (x==0 or y==0 or x==mw-1 or y==mh-1):distance[p]=1;q.append(p)
 while q:
  p=q.popleft();x,y=p%mw,p//mw
  for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
   if 0<=nx<mw and 0<=ny<mh:
    j=ny*mw+nx
    if distance[j]>distance[p]+1:distance[j]=distance[p]+1;q.append(j)
 for y in range(r['height']):
  for x in range(r['width']):
   i=((r['y']+y)*w+r['x']+x)*4;p=list(before[i:i+4]);k=o['kind']
   if not mask[y*mw+x] or (k=='stroke' and distance[y*mw+x]>o['thickness']):continue
   if k in ['fill','stroke']:q=o['color']
   elif k=='grayscale':v=nearest(F(77*p[0]+150*p[1]+29*p[2],256));q=[v,v,v,p[3]]
   elif k=='invert':q=[255-p[0],255-p[1],255-p[2],p[3]]
   elif k=='alpha':q=p[:3]+[min(255,nearest(F(p[3]*o['percent'],100)))]
   elif k=='replace':q=o['color'] if p==o['match'] else p
   elif k=='checker':q=o['end'] if (x//o['cellWidth']+y//o['cellHeight'])%2 else o['start']
   else:
    if k=='radial':
     cx=F(r['width']-1,2);cy=F(r['height']-1,2);dx=F(x)-cx;dy=F(y)-cy;t=min(F(1),(dx/max(cx,F(1,2)))**2+(dy/max(cy,F(1,2)))**2)
    else:
     span=r['width']-1 if o['axis']=='horizontal' else r['height']-1;t=F(x if o['axis']=='horizontal' else y,span) if span else F(0)
    if k=='dither-gradient':q=o['start'] if t==0 else o['end'] if t==1 or t>=F(2*bayer[y%4][x%4]+1,32) else o['start']
    else:q=[nearest(F(a)*(1-t)+F(b)*t) for a,b in zip(o['start'],o['end'])]
   changed+=q!=p;out[i:i+4]=bytes(q)
 assert bytes(out)==base64.b64decode(c['after']),o
 assert changed==c['changed'],o
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python Fraction interpolation, geometric center coordinates, generated Bayer thresholds and independent BFS stroke distances and masked complete RGBA/count comparisons'}))
