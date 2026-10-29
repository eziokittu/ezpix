import json,base64,sys,math
from pathlib import Path
from fractions import Fraction as F
from PIL import Image
root=Path(sys.argv[1]);cases=json.loads((root/'cases.json').read_text());samples=0;pixels=0
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

def byte(v):return math.floor(v+.5+1e-12)
def unpack(m):return list(base64.b64decode(m['data']))
def at(m,data,x,y):
 r=m['rect'];return data[(y-r['y'])*r['width']+x-r['x']] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else m['outside']
def oracle(m,e):
 values=unpack(m);r=dict(m['rect']);w=r['width'];h=r['height'];outside=m['outside'];kind=e['kind'];out=values[:]
 if kind=='gradient':
  dx=e['end']['x']-e['start']['x'];dy=e['end']['y']-e['start']['y'];n=dx*dx+dy*dy;out=[]
  for y in range(h):
   for x in range(w):
    ax=x-e['start']['x'];ay=y-e['start']['y'];t=math.sqrt((ax*ax+ay*ay)/n) if e['radial'] else (ax*dx+ay*dy)/n;t=max(0,min(1,t));out.append(byte(e['from']+(e['to']-e['from'])*t))
 elif kind in ['levels','threshold']:
  def adjust(v):return (255 if v>=e['value'] else 0) if kind=='threshold' else byte(255*max(0,min(1,(v-e['low'])/(e['high']-e['low'])))**(1/e['gamma']))
  out=[adjust(v) for v in values];outside=adjust(outside)
 elif kind=='morph':
  out=[];radius=e['radius']
  for y in range(h):
   for x in range(w):
    neighbourhood=[at(m,values,r['x']+x+dx,r['y']+y+dy) for dy in range(-radius,radius+1) for dx in range(-radius,radius+1)];out.append(max(neighbourhood) if e['operation']=='grow' else min(neighbourhood))
 elif kind=='combine':
  other=e['mask'];b=unpack(other);br=other['rect'];left=min(r['x'],br['x']);top=min(r['y'],br['y']);width=max(r['x']+w,br['x']+br['width'])-left;height=max(r['y']+h,br['y']+br['height'])-top
  def combine(a,b):return min(a,b) if e['mode']=='min' else max(a,b) if e['mode']=='max' else byte(a*b/255) if e['mode']=='multiply' else max(0,a-b)
  out=[combine(at(m,values,left+x,top+y),at(other,b,left+x,top+y)) for y in range(height) for x in range(width)];outside=combine(outside,other['outside']);r={'x':left,'y':top,'width':width,'height':height}
 elif kind=='transform':
  o=e['options'];width,height,sample=sampler(o['warp'],w,h);out=[]
  for y in range(height):
   for x in range(width):
    sx,sy=sample(width-1-x if o['flipX'] else x,height-1-y if o['flipY'] else y);out.append(values[sy*w+sx] if 0<=sx<w and 0<=sy<h else outside)
  r={'x':o['x'],'y':o['y'],'width':width,'height':height}
 return out,r,outside
for case in cases:
 expected,r,outside=oracle(case['before'],case['edit']);after=case['after'];assert unpack(after)==expected,('coverage oracle',case['i']);assert after['rect']==r and after['outside']==outside and after['enabled']==case['before']['enabled'];assert case['project']['tiles']==case['projectBefore']['tiles'],'raw artwork remains unchanged';im=Image.open(root/f"mask-{case['i']}.png").convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());assert actual==[(v,v,v,255) for v in expected];samples+=len(expected)
 d=case['project'];im=Image.open(root/f"art-{case['i']}.png").convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());wanted=[]
 for y in range(24):
  for x in range(32):
   cov=at(after,expected,x,y) if after['enabled'] else 255;alpha=0 if (x,y)==(4,4) else byte(200*cov/255);wanted.append((12,34,56,alpha) if alpha else (0,0,0,0))
 assert actual==wanted,('rendered alpha',case['i']);pixels+=len(wanted)
browser_cases=json.loads((root/'browser-cases.json').read_text()) if (root/'browser-cases.json').exists() else []
for case in browser_cases:
 expected,r,outside=oracle(case['before'],case['edit']);assert unpack(case['after'])==expected,('actual browser coverage',case['i']);assert case['after']['rect']==r and case['after']['outside']==outside; samples+=len(expected)
browser_pixels=0
if (root/'browser-latest.ezpix').exists():
 d=json.loads((root/'browser-latest.ezpix').read_text());assert d['tiles']==[];m=d['layers'][0]['mask'];values=unpack(m);im=Image.open(root/'browser-artwork.png').convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());expected=[]
 for y in range(d['height']):
  for x in range(d['width']):
   v=at(m,values,x,y) if m['enabled'] else 255;expected.append((20,40,60,v) if v else (0,0,0,0))
 assert actual==expected,'actual browser rendered PNG';browser_pixels=len(expected)
if (root/'browser.ezcoverage').exists():
 m=json.loads((root/'browser.ezcoverage').read_text());assert m['outside']==64 and m['rect']=={'x':10,'y':10,'width':3,'height':3};assert unpack(m)==[0,32,64,96,128,160,192,224,255];im=Image.open(root/'browser-mask.png').convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());assert actual==[(v,v,v,255) for v in unpack(m)]
browser_checks=0
for path in root.glob('browser-*.ezpix'):
 d=json.loads(path.read_text());assert d['version'] in (3,4,5)
 for l in d['layers']:
  if l.get('mask'):assert len(base64.b64decode(l['mask']['data']))==l['mask']['rect']['width']*l['mask']['rect']['height'];browser_checks+=1
result={'status':'passed','fixtures':len(cases),'coverageSamples':samples,'pixels':pixels,'browserMaskFiles':browser_checks,'browserCases':len(browser_cases),'browserPixels':browser_pixels,'checks':['independent gradient/tonal/algebra/morphology','rational geometry oracle','Pillow coverage and artwork PNG','raw tile preservation']};(root/'independent.json').write_text(json.dumps(result,indent=2));print('PASS '+json.dumps(result))
