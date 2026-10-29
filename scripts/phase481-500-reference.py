import json,base64,sys,math,zipfile,io
from pathlib import Path
from fractions import Fraction as F
from functools import lru_cache
from PIL import Image
root=Path(sys.argv[1]);pixels=slots=files=0
def read(path):return json.loads(path.read_text(encoding='utf-8'))
@lru_cache(maxsize=4096)
def data(text):return base64.b64decode(text,validate=True)
def rnd(x):return math.floor(x+F(1,2))
def lookup(l,key):
 out={}
 for c in l[key]:out[c['frameId']]=out[c['link']] if 'link' in c else c['tiles'] if key=='cels' else c['mask']
 return out
def index(d,l,f,x,y):
 t=dict(lookup(l,'cels')[f]);key=f'{x//64},{y//64}'
 if key in t:return data(d['tiles'][t[key]])[(y%64)*64+x%64]
 r=l['backgroundBounds'];return l['backgroundIndex'] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else d['indexed']['transparentIndex']
def raw(d,l,f,x,y):
 if 'indexed' in d:return d['indexed']['palette'][index(d,l,f,x,y)]
 t=dict(lookup(l,'cels')[f]);key=f'{x//64},{y//64}'
 if key in t:
  at=((y%64)*64+x%64)*4;return list(data(d['tiles'][t[key]])[at:at+4])
 r=l['backgroundBounds'];return l['background'] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else [0,0,0,0]
def coverage(l,f,x,y):
 m=lookup(l,'maskCels')[f] if 'maskCels' in l else l.get('mask')
 if not m or not m['enabled']:return 255
 r=m['rect'];return data(m['data'])[(y-r['y'])*r['width']+x-r['x']] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else m['outside']
def pixel(d,f,x,y):
 rgb=[F(0)]*3;a=F(0)
 for l in d['layers']:
  if not l['visible']:continue
  p=raw(d,l,f,x,y);sa=F(p[3]*l['opacity']*coverage(l,f,x,y),255**3);rgb=[p[k]*sa+rgb[k]*(1-sa) for k in range(3)];a=sa+a*(1-sa)
 return [rnd(v/a) for v in rgb]+[rnd(a*255)] if a else [0,0,0,0]
def png(d,f,path):
 global pixels,files
 im=Image.open(path).convert('RGBA');assert im.size==(d['width'],d['height']);p=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata())
 for y in range(d['height']):
  for x in range(d['width']):
   expected=pixel(d,f,x,y);assert p[y*d['width']+x]==tuple(expected),(str(path),x,y,p[y*d['width']+x],expected);pixels+=1
 files+=1
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


def cel_root(layer,frame):
    for c in layer['cels']:
        if c['frameId']==frame:return cel_root(layer,c['link']) if 'link' in c else frame
    raise AssertionError('missing cel')

def check(case,browser=False):
    global slots
    before=case['before'];after=case['after'];li=next(i for i,l in enumerate(before['layers']) if l['id']==before['activeLayerId']);frame=before['activeFrameId'];m=case['mask'];r=m['rect'];o=case['options'];sw=r['width'];sh=r['height'];w,h,sample=sampler(o['warp'],sw,sh)
    old=before['layers'][li];new=after['layers'][li];role=before['indexed']['transparentIndex'];source=[index(before,old,frame,r['x']+x,r['y']+y) for y in range(sh) for x in range(sw)]
    if case.get('clipboardFile'):
        clipboard=read(root/case['clipboardFile']);assert clipboard['palette']==before['indexed']['palette'] and clipboard['transparentIndex']==role;source=list(data(clipboard['indices']));assert list(data(clipboard['membership']))==m['bits']
    output=[];outbits=[]
    for y in range(h):
        for x in range(w):
            sx,sy=sample(w-1-x if o['flipX'] else x,h-1-y if o['flipY'] else y);member=int(0<=sx<sw and 0<=sy<sh and m['bits'][sy*sw+sx]);outbits.append(member);output.append(source[sy*sw+sx] if member else role)
    if 'output' in case:assert case['output']=={'width':w,'height':h,'bits':outbits,'indices':output},case['i']
    assert after['indexed']==before['indexed']
    for l in range(len(before['layers'])):
        for f in before['frames']:
            expected=[index(before,before['layers'][l],f['id'],x,y) for y in range(before['height']) for x in range(before['width'])]
            if l==li and cel_root(old,f['id'])==cel_root(old,frame):
                if not o['copy'] and not case.get('clipboard'):
                    for j,v in enumerate(m['bits']):
                        if v:expected[(r['y']+j//sw)*before['width']+r['x']+j%sw]=role
                for j,v in enumerate(outbits):
                    if v:expected[(o['y']+j//w)*before['width']+o['x']+j%w]=output[j]
            actual=[index(after,after['layers'][l],f['id'],x,y) for y in range(after['height']) for x in range(after['width'])]
            assert actual==expected,('raw indices',case['i'],l,f['id']);slots+=len(actual)
        assert after['layers'][l].get('maskCels')==before['layers'][l].get('maskCels')
        assert after['layers'][l].get('mask')==before['layers'][l].get('mask')
    if not browser:
        for f in after['frames']:png(after,f['id'],root/f"fixture-{case['i']}-{f['id']}.png")
        if case.get('clipboard'):
            c=read(root/f"fixture-{case['i']}.ezclipboard");assert c['palette']==before['indexed']['palette'] and c['transparentIndex']==role
            rawslots=data(c['indices']);rawbits=data(c['membership']);assert list(rawbits)==m['bits'];assert list(rawslots)==[v if m['bits'][j] else role for j,v in enumerate(source)]

fixtures=read(root/'fixtures.json')
for case in fixtures:check(case)
browser_cases=read(root/'browser-cases.json') if (root/'browser-cases.json').exists() else []
for case in browser_cases:check(case,True)
if (root/'browser-cut.json').exists():
    case=read(root/'browser-cut.json');d=case['before'];after=case['after'];m=case['mask'];r=m['rect'];li=next(i for i,l in enumerate(d['layers']) if l['id']==d['activeLayerId']);frame=d['activeFrameId'];role=d['indexed']['transparentIndex']
    c=read(root/case['clipboardFile']);assert c['palette']==d['indexed']['palette'] and c['transparentIndex']==role
    assert list(data(c['membership']))==m['bits'];assert list(data(c['indices']))==[index(d,d['layers'][li],frame,r['x']+j%r['width'],r['y']+j//r['width']) if v else role for j,v in enumerate(m['bits'])]
    for i,l in enumerate(d['layers']):
        for f in d['frames']:
            for y in range(d['height']):
                for x in range(d['width']):
                    expected=index(d,l,f['id'],x,y)
                    if i==li and cel_root(l,f['id'])==cel_root(l,frame) and r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] and m['bits'][(y-r['y'])*r['width']+x-r['x']]:expected=role
                    assert index(after,after['layers'][i],f['id'],x,y)==expected;slots+=1
if (root/'browser-exports.ezpix').exists():
    d=read(root/'browser-exports.ezpix')
    for i,f in enumerate(d['frames']):png(d,f['id'],root/f'browser-frame-{i}.png')
    with zipfile.ZipFile(root/'browser-animation.zip') as z:
        names=sorted(n for n in z.namelist() if n.endswith('.png'));assert len(names)==len(d['frames'])
        for f,n in zip(d['frames'],names):
            path=root/('zip-'+n.rsplit('/',1)[-1]);path.write_bytes(z.read(n));png(d,f['id'],path)
if (root/'browser-clipboard.ezclipboard').exists():
    clip=read(root/'browser-clipboard.ezclipboard');assert clip['mode']=='indexed';assert len(data(clip['indices']))==clip['width']*clip['height'];assert len(data(clip['membership']))==clip['width']*clip['height']
report={'fixtures':len(fixtures),'browserTransforms':len(browser_cases),'rawSlotChecks':slots,'renderedPixels':pixels,'pngImages':files}
(root/'independent-result.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS independent slot transforms',json.dumps(report))
