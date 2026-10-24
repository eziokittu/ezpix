from pathlib import Path
from PIL import Image
import json,sys,struct,io
out=Path('artifacts/phase13fefg');out.mkdir(parents=True,exist_ok=True)
if len(sys.argv)>2 and sys.argv[1]=='downloads':
 root=Path(sys.argv[2]);checks=0
 for item in json.loads((root/'downloads.json').read_text()):
  data=(root/item['file']).read_bytes();assert list(Image.open(io.BytesIO(data)).convert('RGBA').tobytes())==item['pixels'];assert data[25]==item['type'];checks+=1
 print(json.dumps(dict(status='passed',checks=checks,reader='Pillow actual downloaded PNG files')))
elif len(sys.argv)>1 and sys.argv[1]=='fixtures':
 entries=[]
 for mode in ['L','LA','P']:
  im=Image.new(mode,(7,5))
  if mode=='L':im.putdata([(i*37)%256 for i in range(35)]);im.info['transparency']=37
  elif mode=='LA':im.putdata([((i*37)%256,[0,1,128,255][i%4]) for i in range(35)])
  else:
   im.putpalette([v for i in range(256) for v in ((i*19)%256,(i*47)%256,(i*83)%256)]);im.putdata([i%32 for i in range(35)]);im.info['transparency']=bytes([0,1,128,255]*64)
  name=mode+'.png';im.save(out/name,bits=8);entries.append(dict(file=name,pixels=list(Image.open(out/name).convert('RGBA').tobytes())))
 (out/'fixtures.json').write_text(json.dumps(entries));print('Created independent Pillow PNG fixtures')
else:
 inputs=json.loads((out/'modes.json').read_text());checks=0;pixels=0
 for item in inputs:
  expected=[];palette=[tuple(bytes.fromhex(c[1:])) for c in item['palette']]
  for at in range(0,len(item['source']),4):
   r,g,b,a=item['source'][at:at+4]
   if a==0:expected.extend([0,0,0,0]);continue
   if item['mode']=='grayscale':
    gray=(299*r+587*g+114*b+500)//1000;expected.extend([gray,gray,gray,a])
   else:
    index=min(range(len(palette)),key=lambda i:sum((p-q)**2 for p,q in zip((r,g,b),palette[i])));expected.extend([*palette[index],a])
  assert item['output']==expected,(item['case'],item['mode']);checks+=1;pixels+=len(expected)//4
  for path in item['files']:
   data=(out/path).read_bytes();im=Image.open(io.BytesIO(data));assert list(im.convert('RGBA').tobytes())==expected,path
   assert data[24]==8 and data[25]==(4 if path.endswith('-gray.png') else 3),path;checks+=1
 print(json.dumps(dict(status='passed',checks=checks,pixels=pixels,reader='Python integer grayscale/nearest-palette oracle and Pillow PNG decoders')))
