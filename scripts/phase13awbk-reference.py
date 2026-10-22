import json,sys,base64,io
from PIL import Image
cases=json.load(open(sys.argv[1],encoding='utf-8'))
for c in cases:
 w,h=c['w'],c['h'];r=c['rect'];kind=c['kind'];before=[bytearray(base64.b64decode(b) or bytes(w*h*4)) for b in c['before']];copied=bytearray(w*h*4);cropped=bytearray()
 cropped=bytearray(r['width']*r['height']*4)
 for y in range(r['height']):
  for x in range(r['width']):
   if not c['mask'][y*r['width']+x]: continue
   a=((y+r['y'])*w+x+r['x'])*4;b=(y*r['width']+x)*4
   copied[a:a+4]=before[0][a:a+4];cropped[b:b+4]=before[0][a:a+4]
 if kind.startswith('export'):
  if kind=='export-png':
   image=Image.open(io.BytesIO(base64.b64decode(c['png']))).convert('RGBA');assert image.size==(r['width'],r['height']);assert image.tobytes()==bytes(cropped)
  else:
   d=c['project'];assert (d['width'],d['height'])==(r['width'],r['height']);assert len(d['frames'])==len(d['layers'])==1;assert d.get('conversion') is None;assert not d['references'] and not d['groups'] and not d['tags'];assert d['layers'][0]['opacity']==255
   assert base64.b64decode(c['projectPixels'])==bytes(cropped)
  assert c['before']==c['source']
 else:
  for f in range(4):
   source=before[f][:]
   if kind in ('cut-layer','clear') and f in (0,1):
    for y in range(r['height']):
     for x in range(r['width']):
      if c['mask'][y*r['width']+x]:
       a=((y+r['y'])*w+x+r['x'])*4;source[a:a+4]=bytes(4)
   actual=base64.b64decode(c['source'][f]) or bytes(w*h*4);assert bytes(source)==actual
   if kind!='clear':
    expected=copied if f==0 or kind=='cut-layer' and f==1 else bytes(w*h*4);actual=base64.b64decode(c['destination'][f]) or bytes(w*h*4);assert bytes(expected)==actual
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python binary membership oracle and independent frame rules; Pillow raw PNG; cropped project properties'}))
