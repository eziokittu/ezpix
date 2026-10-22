"""Independent destination-gather geometry oracle using standard library only."""
import base64,json,sys
from fractions import Fraction
cases=json.load(open(sys.argv[1],encoding='utf-8'))
checked=0
for case in cases:
 before,after,o=case['before'],case['after'],case['options']
 ow,oh=before['width'],before['height']
 def cels(layer,w,h):
  out={}
  for c in layer['cels']:
   out[c['frameId']]=out[c['link']] if 'link' in c else base64.b64decode(c['rgba']) if 'rgba' in c else bytes(w*h*4)
  return out
 raw=[cels(l,ow,oh) for l in before['layers']]
 if o['kind']=='trim':
  points=[(i//4%ow,i//4//ow) for layer in raw for p in layer.values() for i in range(0,len(p),4) if any(p[i:i+4])]
  x=min((p[0] for p in points),default=0);y=min((p[1] for p in points),default=0)
  w=max((p[0] for p in points),default=ow-1)-x+1;h=max((p[1] for p in points),default=oh-1)-y+1
 elif o['kind']=='scale': x,y,w,h=0,0,o['width'],o['height']
 elif o['kind']=='crop': x,y,w,h=[o[k] for k in ('x','y','width','height')]
 else:
  w,h=o['width'],o['height']
  def origin(key,delta,offset):
   v=o[key];return -(0 if v=='start' else delta if v=='end' else divmod(delta,2)[0])-o[offset]
  x=origin('anchorX',w-ow,'offsetX');y=origin('anchorY',h-oh,'offsetY')
 assert (after['width'],after['height'])==(w,h)
 for i,layer in enumerate(raw):
  actual=cels(after['layers'][i],w,h)
  for frame,p in layer.items():
   rows=[]
   for dy in range(h):
    for dx in range(w):
     if o['kind']=='scale':
      def nearest(d,old,new):
       coordinate=Fraction(2*d+1,2)*old/new-Fraction(1,2)
       low=coordinate.numerator//coordinate.denominator
       return low+int(coordinate-low>=Fraction(1,2))
      sx,sy=nearest(dx,ow,w),nearest(dy,oh,h)
     else: sx,sy=dx+x,dy+y
     rows.extend(p[(sy*ow+sx)*4:(sy*ow+sx+1)*4] if 0<=sx<ow and 0<=sy<oh else [0]*4)
   assert bytes(rows)==actual[frame],f"case {checked} layer {i} frame {frame}"
 checked+=1
print(json.dumps({'status':'passed','cases':checked,'reference':'Python destination-gather matrix; stdlib base64/JSON; all cels including links/hidden RGB'}))
