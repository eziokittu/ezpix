import json,base64,sys
from pathlib import Path
from fractions import Fraction as F
from PIL import Image
root=Path(sys.argv[1]);cases=json.loads((root/'cases.json').read_text());pixels=0;maskbytes=0
def rnd(v):return (2*v.numerator+v.denominator)//(2*v.denominator)
def layers(d):
 table=[base64.b64decode(v) for v in d['tiles']];out=[]
 for l in d['layers']:
  maps={}
  for c in l['cels']:maps[c['frameId']]=maps[c['link']] if 'link' in c else {k:table[i] for k,i in c['tiles']}
  out.append((l,maps))
 return out
def raw(l,m,x,y):
 tile=m.get(f'{x//64},{y//64}');b=l['backgroundBounds']
 if tile is not None:
  j=((y%64)*64+x%64)*4;return list(tile[j:j+4])
 return l['background'] if b['x']<=x<b['x']+b['width'] and b['y']<=y<b['y']+b['height'] else [0,0,0,0]
def coverage(l,x,y):
 m=l.get('mask')
 if not m or not m['enabled']:return 255
 r=m['rect']
 return base64.b64decode(m['data'])[(y-r['y'])*r['width']+x-r['x']] if r['x']<=x<r['x']+r['width'] and r['y']<=y<r['y']+r['height'] else m['outside']
def composite(decoded,frame,x,y):
 rgb=[F(0)]*3;a=F(0)
 for l,m in decoded:
  if not l['visible']:continue
  p=raw(l,m[frame],x,y);sa=F(p[3]*l['opacity']*coverage(l,x,y),255**3);rgb=[p[k]*sa+rgb[k]*(1-sa) for k in range(3)];a=sa+a*(1-sa)
 return tuple([rnd(v/a) for v in rgb]+[rnd(a*255)]) if a else (0,0,0,0)
for case in cases:
 d=case['project'];decoded=layers(d);before=layers(case['before']);old=before[-1][0];new=decoded[-1][0]
 if case['baked']:
  assert 'mask' not in new
  for f in d['frames']:
   for y in range(d['height']):
    for x in range(d['width']):
     p=raw(old,before[-1][1][f['id']],x,y);p=p[:3]+[rnd(F(p[3]*coverage(old,x,y),255))];assert raw(new,decoded[-1][1][f['id']],x,y)==p,('bake',case['i'],x,y)
 elif case['geometry']:
  m=new['mask'];r=m['rect'];data=base64.b64decode(m['data']);g=case['geometry']
  for y in range(r['height']):
   for x in range(r['width']):assert data[y*r['width']+x]==coverage({**old,'mask':{**old['mask'],'enabled':True}},r['x']+x-g['dx'],r['y']+y-g['dy']),('geometry mask',case['i'])
 for f in case['files']:
  im=Image.open(root/f['name']).convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());expected=[composite(decoded,f['frame'],x,y) for y in range(d['height']) for x in range(d['width'])];assert actual==expected,('composite PNG',case['i'],f['frame']);pixels+=len(expected)
 if new.get('mask'):
  m=new['mask'];im=Image.open(root/f"mask-{case['i']}.png").convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());data=base64.b64decode(m['data']);assert actual==[(v,v,v,255) for v in data];maskbytes+=len(data)
for p in sorted(root.glob('browser-*.ezpix')):
 d=json.loads(p.read_text());assert d['version'] in (3,4,5)
 for l in d['layers']:
  if l.get('mask'):assert len(base64.b64decode(l['mask']['data']))==l['mask']['rect']['width']*l['mask']['rect']['height']
browser_pixels=0
if (root/'browser-png-project.ezpix').exists():
 d=json.loads((root/'browser-png-project.ezpix').read_text());decoded=layers(d);im=Image.open(root/'browser-artwork.png').convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());expected=[composite(decoded,d['activeFrameId'],x,y) for y in range(d['height']) for x in range(d['width'])];assert actual==expected,'actual browser masked PNG';browser_pixels=len(expected)
if (root/'browser-mask.png').exists():
 d=json.loads((root/'browser-png-import.ezpix').read_text());m=d['layers'][0]['mask'];im=Image.open(root/'browser-mask.png').convert('RGBA');actual=list(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata());assert actual==[(v,v,v,255) for v in base64.b64decode(m['data'])],'actual grayscale mask PNG'
result={'status':'passed','fixtures':len(cases),'pixels':pixels,'browserPixels':browser_pixels,'maskBytes':maskbytes,'checks':['Fraction masked source-over','independent baked raw alpha','translated coverage','Pillow artwork and grayscale mask PNG']};(root/'independent.json').write_text(json.dumps(result,indent=2));print('PASS '+json.dumps(result))
