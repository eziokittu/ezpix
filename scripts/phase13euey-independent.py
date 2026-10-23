"""Independent Pillow readers/writers and XML raster oracle for phases 193-197."""
from PIL import Image
from pathlib import Path
import json,sys,xml.etree.ElementTree as ET
out=Path('artifacts/phase13euey');out.mkdir(parents=True,exist_ok=True)
if len(sys.argv)>1 and sys.argv[1]=='fixtures':
 entries=[]
 for kind in ['busy','disposal','interlace']:
  w,h=(256,96) if kind=='busy' else (12,12) if kind=='disposal' else (32,32)
  frames=[]
  for f in range(4 if kind=='disposal' else 1):
   im=Image.new('RGBA',(w,h),(0,0,0,0))
   for y in range(h):
    for x in range(w):
     if kind=='busy' or kind=='interlace' or (x+f*2)%12<5:
      im.putpixel((x,y),((x*73+y*39+f*11)%256,(x*17+y*81)%256,(x*51+y*13)%256,255))
   frames.append(im)
  path=out/(kind+'.gif');frames[0].save(path,save_all=True,append_images=frames[1:],duration=[30,110,220,90][:len(frames)],loop=2,disposal=[1,2,3,1][:len(frames)] if kind=='disposal' else 1,optimize=False,interlace=True)
  decoded=Image.open(path);rgba=[];dur=[]
  for n in range(decoded.n_frames):
   decoded.seek(n);rgba.append(list(decoded.convert('RGBA').tobytes()));dur.append(decoded.info.get('duration',100))
  entries.append(dict(file=path.name,width=w,height=h,frames=rgba,durations=dur))
 # Independent BMP 24-bit with row padding and QOI encoder, alpha and runs.
 im=Image.new('RGBA',(7,5));im.putdata([((i*19)%256,(i*47)%256,(i*83)%256,[0,1,128,255][i%4]) for i in range(35)])
 for ext in ['bmp','qoi']:
  src=im.convert('RGB') if ext=='bmp' else im
  path=out/('pillow.'+ext);src.save(path,colorspace="sRGB")
  entries.append(dict(file=path.name,width=7,height=5,frames=[list(Image.open(path).convert('RGBA').tobytes())]))
 (out/'fixtures.json').write_text(json.dumps(entries));print('Created independent Pillow fixtures')
else:
 entries=json.loads((out/'exports.json').read_text());checks=0
 for entry in entries:
  path=out/entry['file']
  if path.suffix=='.svg':
   root=ET.parse(path).getroot();w=int(root.attrib['width']);h=int(root.attrib['height']);pixels=[0]*(w*h*4)
   for rect in root:
    a=rect.attrib;x=int(a['x']);y=int(a['y']);rw=int(a['width']);rgb=bytes.fromhex(a['fill'][1:]);alpha=round(float(a['fill-opacity'])*255)
    for col in range(rw):pixels[(y*w+x+col)*4:(y*w+x+col+1)*4]=[*rgb,alpha]
   expected=entry['frames'][0].copy()
   for i in range(0,len(expected),4):
    if expected[i+3]==0:expected[i:i+4]=[0,0,0,0]
   assert pixels==expected,path
  else:
   im=Image.open(path);assert im.size==(entry['width'],entry['height'])
   assert getattr(im,'n_frames',1)==len(entry['frames'])
   for n,expected in enumerate(entry['frames']):
    im.seek(n);got=list(im.convert('RGBA').tobytes())
    if entry.get('quantized'):
     expected=expected.copy()
     for i in range(0,len(expected),4):
      for j,levels in enumerate([5,6,5]):
       level=(expected[i+j]*levels*2+255)//510
       expected[i+j]=(level*255*2+levels)//(2*levels)
    assert got==expected,(path,n,next((i for i,(a,b) in enumerate(zip(got,expected)) if a!=b),None))
    if path.suffix=='.gif':
     assert im.info.get('duration')==entry['durations'][n]
     assert im.info.get('loop')==(0 if entry['plays']==0 else entry['plays']-1)
    checks+=1
  checks+=1
 print(json.dumps(dict(status='passed',checks=checks,reader='Pillow and Python XML rectangle rasterizer')))
