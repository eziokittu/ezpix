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
 im=Image.open(path).convert('RGBA');assert im.size==(d['width'],d['height']);p=list(im.getdata())
 for y in range(d['height']):
  for x in range(d['width']):
   expected=pixel(d,f,x,y);assert p[y*d['width']+x]==tuple(expected),(str(path),x,y,p[y*d['width']+x],expected);pixels+=1
 files+=1
fixtures=read(root/'fixtures.json')
for case in fixtures:
 before=case['before'];d=case['after'];rgba=case['rgba'];edit=case['edit'];assert d['version']==5 and 'indexed' not in rgba
 assert all(len(data(t))==4096 for t in d['tiles'])
 if edit['kind']=='palette-reorder':
  assert all(d['indexed']['palette'][edit['mapping'][i]]==c for i,c in enumerate(before['indexed']['palette']))
 else:
  assert d['tiles']==before['tiles'];assert d['indexed']['palette'][edit['index']]==edit['color']
 for k,f in enumerate(d['frames']):
  for li,l in enumerate(d['layers']):
   for y in range(d['height']):
    for x in range(d['width']):
     old=index(before,before['layers'][li],f['id'],x,y);expected=edit['mapping'][old] if edit['kind']=='palette-reorder' else old
     assert index(d,l,f['id'],x,y)==expected;assert raw(rgba,rgba['layers'][li],f['id'],x,y)==raw(d,l,f['id'],x,y);slots+=1
  png(d,f['id'],root/f"fixture-{case['i']}-{k}.png")
browser=list(root.glob('browser-*.ezpix'))
for p in browser:
 d=read(p);assert d['version']==5
 if 'indexed' in d:assert all(len(data(t))==4096 for t in d['tiles'])
latest=root/'browser-exports.ezpix'
if latest.exists():
 d=read(latest)
 for k,f in enumerate(d['frames']):png(d,f['id'],root/f'browser-frame-{k}.png')
 with zipfile.ZipFile(root/'browser-animation.zip') as z:
  meta=json.loads(z.read('animation.json'));assert [f['duration'] for f in meta['frames']]==[f['duration'] for f in d['frames']]
  for f,entry in zip(d['frames'],meta['frames']):png(d,f['id'],io.BytesIO(z.read(entry['file'])))
result={'status':'passed','fixtures':len(fixtures),'slotAndRawRGBAChecks':slots,'rgbaPixels':pixels,'pngFiles':files,'browserProjects':len(browser),'oracle':'Independent base64 slot reader, exact remap/raw RGBA, Fraction palette/mask/layer composition, Pillow PNG and stdlib ZIP'}
(root/'independent.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print('PASS '+json.dumps(result))
