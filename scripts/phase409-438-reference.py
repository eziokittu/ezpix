import json,base64,sys,math,zipfile,io
from pathlib import Path
from fractions import Fraction as F
from PIL import Image
root=Path(sys.argv[1]);pixels=0;samples=0;files=0
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def rnd(x):return math.floor(x+F(1,2))
def cels(layer,key):
 out={}
 for c in layer[key]:
  assert c['frameId'] not in out
  if 'link' in c:
   assert c['link'] in out
   out[c['frameId']]=out[c['link']]
  else:out[c['frameId']]=c['mask'] if key=='maskCels' else c['tiles']
 return out
def mask_at(l,f):return cels(l,'maskCels')[f] if 'maskCels' in l else l.get('mask')
def coverage(m,x,y):
 if not m or not m['enabled']:return 255
 r=m['rect']
 if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height']:return base64.b64decode(m['data'],validate=True)[(y-r['y'])*r['width']+x-r['x']]
 return m['outside']
def raw(d,l,f,x,y):
 tiles=dict(cels(l,'cels')[f]);key=f'{x//64},{y//64}'
 if key in tiles:
  p=base64.b64decode(d['tiles'][tiles[key]],validate=True);i=((y%64)*64+x%64)*4;return list(p[i:i+4])
 r=l['backgroundBounds'];return l['background'] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else [0,0,0,0]
def pixel(d,f,x,y):
 a=F(0);rgb=[F(0)]*3
 for l in d['layers']:
  if not l['visible']:continue
  p=raw(d,l,f,x,y);sa=F(p[3]*l['opacity']*coverage(mask_at(l,f),x,y),255**3)
  rgb=[p[k]*sa+rgb[k]*(1-sa) for k in range(3)];a=sa+a*(1-sa)
 return [rnd(v/a) for v in rgb]+[rnd(a*255)] if a else [0,0,0,0]
def png_check(d,f,path):
 global pixels,files
 image=Image.open(path).convert('RGBA');assert image.size==(d['width'],d['height']);actual=list(image.getdata())
 for y in range(d['height']):
  for x in range(d['width']):
   expected=pixel(d,f,x,y);assert actual[y*d['width']+x]==tuple(expected),(str(path),x,y,actual[y*d['width']+x],expected);pixels+=1
 files+=1
fixtures=read(root/'fixtures.json')
for case in fixtures:
 i=case['i'];before=case['before'];d=case['after'];baked=case['baked'];assert d['version'] in (4,5)
 assert d['tiles']==before['tiles'];assert d['layers'][0]['cels']==before['layers'][0]['cels']
 first=case['inputs'][0];last=case['inputs'][3]
 for k,f in enumerate(d['frames']):
  t=[F(0),F(1,6),F(1,2),F(1)][k];m=mask_at(d['layers'][0],f['id']);expected=[rnd(a+(b-a)*t) for a,b in zip(first['coverage'],last['coverage'])]
  assert list(base64.b64decode(m['data']))==expected;assert m['outside']==rnd(first['outside']+(last['outside']-first['outside'])*t);samples+=len(expected)+1
  png_check(d,f['id'],root/f'fixture-{i}-frame-{k}.png')
  for y in range(d['height']):
   for x in range(d['width']):
    p=raw(d,d['layers'][0],f['id'],x,y);b=raw(baked,baked['layers'][0],f['id'],x,y);assert b[:3]==p[:3];assert b[3]==rnd(F(p[3]*coverage(m,x,y),255))
browser=list(root.glob('browser-*.ezpix'))
for p in browser:
 d=read(p);assert d['version'] in (4,5)
 for l in d['layers']:
  if 'maskCels' in l:
   assert [c['frameId'] for c in l['maskCels']]==[f['id'] for f in d['frames']]
   assert 'mask' not in l;cels(l,'maskCels')
 latest=root/'browser-before-play.ezpix'
 if latest.exists() and p==latest:
  for k,f in enumerate(d['frames']):png_check(d,f['id'],root/f'browser-frame-{k}.png')
  with zipfile.ZipFile(root/'browser-animation.zip') as z:
   meta=json.loads(z.read('animation.json'));assert [f['duration'] for f in meta['frames']]==[f['duration'] for f in d['frames']]
   for f,entry in zip(d['frames'],meta['frames']):png_check(d,f['id'],io.BytesIO(z.read(entry['file'])))
result={'status':'passed','fixtures':len(fixtures),'coverageSamples':samples,'rgbaPixels':pixels,'pngFiles':files,'browserProjects':len(browser),'oracle':'Python Fraction source-over and duration weights; Pillow PNG; stdlib ZIP; raw tile alpha/RGB checks'}
(root/'independent.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print('PASS '+json.dumps(result))
