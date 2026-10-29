import base64,json,sys,io,zipfile
from fractions import Fraction as F
from PIL import Image
from pathlib import Path
Image.MAX_IMAGE_PIXELS=10240*10240
root=Path(sys.argv[1]);cases=json.loads((root/'cases.json').read_text())
def roundbyte(v):return (v.numerator*2+v.denominator)//(2*v.denominator)
def layers(d):
 table=[base64.b64decode(s) for s in d['tiles']];result=[]
 for l in d['layers']:
  frames={}
  for c in l['cels']:frames[c['frameId']]=frames[c['link']] if 'link' in c else {key:table[index] for key,index in c['tiles']}
  result.append((l,frames))
 return result
def raw(l,m,x,y):
 p=m.get(f'{x//64},{y//64}')
 if p is not None:return p[((y%64)*64+x%64)*4:((y%64)*64+x%64+1)*4]
 b=l['backgroundBounds'];return l['background'] if b['x']<=x<b['x']+b['width'] and b['y']<=y<b['y']+b['height'] else [0,0,0,0]
def composite(decoded,frame,x,y):
 rgb=[F(0)]*3;a=F(0)
 for l,maps in decoded:
  if not l['visible']:continue
  p=raw(l,maps[frame],x,y);sa=F(p[3]*l['opacity'],65025)
  rgb=[p[k]*sa+rgb[k]*(1-sa) for k in range(3)];a=sa+a*(1-sa)
 return [roundbyte(c/a) for c in rgb]+[roundbyte(a*255)] if a else [0,0,0,0]
pixels=0
for case in cases:
 d=case['project'];decoded=layers(d)
 for f in d['frames']:
  expected=[]
  for y in range(d['height']):
   for x in range(d['width']):expected+=composite(decoded,f['id'],x,y);pixels+=1
  assert expected==case['frames'][f['id']],f"composite case {case['id']} frame {f['id']}"
  im=Image.open(root/f"case-{case['id']}-{f['id']}.png").convert('RGBA');assert im.size==(d['width'],d['height']);assert bytes(expected)==im.tobytes()
 z=zipfile.ZipFile(root/f"case-{case['id']}.zip");manifest=json.loads(z.read('animation.json'));assert [f['duration'] for f in manifest['frames']]==[f['duration'] for f in d['frames']]
 for entry,f in zip(manifest['frames'],d['frames']):assert Image.open(io.BytesIO(z.read(entry['file']))).convert('RGBA').tobytes()==Image.open(root/f"case-{case['id']}-{f['id']}.png").convert('RGBA').tobytes()
im=Image.open(root/'maximum.png');assert im.size==(10240,10240);assert im.getpixel((0,0))==(0,0,0,0);assert im.getpixel((10239,10239))==(12,34,56,255)
print(json.dumps({'status':'passed','documents':len(cases),'exact_composite_pixels':pixels,'maximum_png':'10240x10240, empty origin and exact far corner','reference':'Python Fraction source-over + shared-table/link reconstruction + Pillow PNG + zipfile animation/durations'}))

if (root/'browser-expected.ezpix').exists():
 d=json.loads((root/'browser-expected.ezpix').read_text());decoded=layers(d);z=zipfile.ZipFile(root/'browser-frames.zip');meta=json.loads(z.read('animation.json'));count=0
 assert len(meta['frames'])==len(d['frames'])
 for entry,f in zip(meta['frames'],d['frames']):
  expected=bytes(v for y in range(d['height']) for x in range(d['width']) for v in composite(decoded,f['id'],x,y));count+=d['width']*d['height']
  im=Image.open(io.BytesIO(z.read(entry['file']))).convert('RGBA');assert im.size==(d['width'],d['height']);assert im.tobytes()==expected;assert entry['duration']==f['duration']
  if f['id']==d['activeFrameId']:assert Image.open(root/'browser-selected.png').convert('RGBA').tobytes()==expected
 source=json.loads((root/'bridge-sized.ezpix').read_text());decoded=layers(source);dense=json.loads((root/'dense-bridge.ezpix').read_text());bridge_bytes=0
 assert (dense['width'],dense['height'])==(source['width'],source['height']);assert len(dense['layers'])==len(source['layers']);assert dense['frames']==source['frames']
 for (l,maps),layer in zip(decoded,dense['layers']):
  actual={}
  for cel in layer['cels']:actual[cel['frameId']]=actual[cel['link']] if 'link' in cel else base64.b64decode(cel['rgba']) if 'rgba' in cel else bytes(dense['width']*dense['height']*4)
  assert layer['opacity']==l['opacity'] and layer['visible']==l['visible'] and layer['locked']==l['locked']
  for f in source['frames']:
   expected=bytes(v for y in range(source['height']) for x in range(source['width']) for v in raw(l,maps[f['id']],x,y));assert actual[f['id']]==expected;bridge_bytes+=len(expected)
 imported=json.loads((root/'reviewed-sprite-import.ezpix').read_text());flat=layers(imported)
 assert len(imported['layers'])==1 and len(imported['frames'])==len(source['frames']);assert (imported['width'],imported['height'])==(source['width'],source['height'])
 for original,converted in zip(source['frames'],imported['frames']):
  assert original['duration']==converted['duration'];expected=bytes(v for y in range(source['height']) for x in range(source['width']) for v in composite(decoded,original['id'],x,y));actual=bytes(v for y in range(imported['height']) for x in range(imported['width']) for v in raw(flat[0][0],flat[0][1][converted['id']],x,y));assert actual==expected
 print(json.dumps({'status':'passed','actual_browser_composite_pixels':count,'actual_dense_bridge_rgba_bytes':bridge_bytes,'actual_downloads':'PNG, frame ZIP/durations, v2 projects, dense v16 bridge, reviewed flattening'}))
