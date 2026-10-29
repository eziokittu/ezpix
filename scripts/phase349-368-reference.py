import json,base64,sys,math
from pathlib import Path
from fractions import Fraction as F
from PIL import Image
root=Path(sys.argv[1]);cases=json.loads((root/'cases.json').read_text());pixels=0;members=0
def raw(d):
 table=[base64.b64decode(v) for v in d['tiles']];l=next(v for v in d['layers'] if v['id']==d['activeLayerId']);maps={}
 for cel in l['cels']:maps[cel['frameId']]=maps[cel['link']] if 'link' in cel else dict(cel['tiles'])
 tiles=maps[d['activeFrameId']];out=[];r=l['backgroundBounds']
 for y in range(d['height']):
  for x in range(d['width']):
   p=table[tiles[f'{x//64},{y//64}']] if f'{x//64},{y//64}' in tiles else None;j=((y%64)*64+x%64)*4
   out.append(list(p[j:j+4]) if p else l['background'] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else [0,0,0,0])
 return out
def solve(a):
 # Independent rational Gaussian elimination, unlike the product closed formula.
 n=len(a);a=[[F(v) for v in row] for row in a]
 for k in range(n):
  pivot=next(j for j in range(k,n) if a[j][k]);a[k],a[pivot]=a[pivot],a[k];v=a[k][k];a[k]=[x/v for x in a[k]]
  for j in range(n):
   if j!=k:
    v=a[j][k];a[j]=[a[j][i]-v*a[k][i] for i in range(n+1)]
 return [row[-1] for row in a]
def sampler(warp,sw,sh):
 kind=warp['kind']
 if kind=='turn':
  t=warp['turn'];w=warp['width'];h=warp['height'];rw=sh if t%2 else sw;rh=sw if t%2 else sh
  def sample(x,y):
   u=int(F(2*x+1,2)*rw/w);v=int(F(2*y+1,2)*rh/h)
   return [(u,v),(v,sh-1-u),(sw-1-u,sh-1-v),(sw-1-v,u)][t]
  return w,h,sample
 if kind in ['rotate','shear']:
  if kind=='rotate':
   rad=warp['angle']*math.pi/180;a=d=math.cos(rad);b=-math.sin(rad);c=math.sin(rad);a=0 if abs(a)<1e-12 else a;b=0 if abs(b)<1e-12 else b;c=0 if abs(c)<1e-12 else c;d=0 if abs(d)<1e-12 else d
  else:a=d=1;b=warp['shearX'];c=warp['shearY']
  corners=[(0,0),(a*sw,c*sw),(b*sh,d*sh),(a*sw+b*sh,c*sw+d*sh)];left=min(p[0] for p in corners);top=min(p[1] for p in corners);w=math.ceil(max(p[0] for p in corners)-left-1e-10);h=math.ceil(max(p[1] for p in corners)-top-1e-10)
  def sample(x,y):
   px=x+.5+left;py=y+.5+top;det=a*d-b*c
   return math.floor((d*px-b*py)/det+1e-10),math.floor((a*py-c*px)/det+1e-10)
  return w,h,sample
 q=warp['quad'];equations=[]
 for (u,v),p in zip([(0,0),(sw,0),(sw,sh),(0,sh)],q):
  x=p['x'];y=p['y'];equations += [[u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]]
 a,b,c,d,e,f,g,h=solve(equations)
 def sample(x,y):
  px=F(2*x+1,2);py=F(2*y+1,2);aa=a-px*g;bb=b-px*h;dd=d-py*g;ee=e-py*h;cc=px-c;ff=py-f;det=aa*ee-bb*dd
  if not det:return -1,-1
  return math.floor((cc*ee-bb*ff)/det),math.floor((aa*ff-cc*dd)/det)
 return warp['width'],warp['height'],sample
def check(case,browser=False):
 global pixels,members
 before=raw(case['before']);after=raw(case['after']);r=case['mask']['rect'];bits=case['mask']['bits'];sw=r['width'];sh=r['height'];o=case['options'];width=case['before']['width'];expected=[v[:] for v in before];w,h,sample=sampler(o['warp'],sw,sh);source=case.get('clipboardPixels')
 if source is None:source=[before[(r['y']+y)*width+r['x']+x] for y in range(sh) for x in range(sw)]
 if not o['copy'] and 'clipboardPixels' not in case:
  for y in range(sh):
   for x in range(sw):
    if bits[y*sw+x]:expected[(r['y']+y)*width+r['x']+x]=[0,0,0,0]
 out=[]
 for y in range(h):
  for x in range(w):
   sx,sy=sample(w-1-x if o['flipX'] else x,h-1-y if o['flipY'] else y);member=int(0<=sx<sw and 0<=sy<sh and bits[sy*sw+sx]);out.append(member)
   if member:expected[(o['y']+y)*width+o['x']+x]=source[sy*sw+sx]
 assert after==expected,('independent transformed raw project',case['i'])
 if not browser:
  assert case['output']=={'width':w,'height':h,'bits':out},('membership',case['i'])
  image=Image.open(root/case['png']).convert('RGBA');decoded=list(image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata());assert decoded==[tuple(v if v[3] else [0,0,0,0]) for v in expected],('PNG',case['i'])
  image=Image.open(root/case['maskPng']).convert('RGBA');decoded=list(image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata());assert decoded==[(v*255,v*255,v*255,255) for v in out],('mask PNG',case['i'])
 pixels+=len(expected);members+=w*h
for case in cases:check(case)
browser_cases=json.loads((root/'browser-cases.json').read_text()) if (root/'browser-cases.json').exists() else []
for case in browser_cases:check(case,True)
browser_mask=root/'browser-mask.png'
if browser_mask.exists():
 image=Image.open(browser_mask).convert('RGBA');assert image.size==(3,2);decoded=list(image.get_flattened_data() if hasattr(image,'get_flattened_data') else image.getdata());assert decoded==[(v*255,v*255,v*255,255) for v in [1,0,1,1,1,0]],'actual browser mask PNG'
result={'status':'passed','fixtures':len(cases),'browserCases':len(browser_cases),'pixels':pixels,'membershipSamples':members,'browserMaskPng':browser_mask.exists(),'checks':['independent rational perspective solver','raw shared-table reconstruction','RGBA and membership sampling','overlap and destination holes','Pillow artwork and binary PNG']};(root/'independent.json').write_text(json.dumps(result,indent=2));print('PASS '+json.dumps(result))
