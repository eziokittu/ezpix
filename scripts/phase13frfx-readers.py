import json,base64,sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);data=json.loads((root/'fixtures.json').read_text());checks=0
for f in data['files']:
 b,a=f['before'],f['after'];assert a['version']==15 and a['editingMode']=='grayscale';checks+=1
 assert a['references']==b['references'];assert len(a['palette'])==len(b['palette'])==3;assert a['palette'][:2]==['#000000','#000000'];checks+=3
 for old,new in zip(b['layers'],a['layers']):
  for oc,nc in zip(old['cels'],new['cels']):
   if 'rgba' not in oc:assert oc==nc;checks+=1;continue
   raw=base64.b64decode(oc['rgba']);actual=base64.b64decode(nc['rgba']);expected=bytearray(raw)
   for i in range(0,len(raw),4):
    gray=(299*raw[i]+587*raw[i+1]+114*raw[i+2]+500)//1000;expected[i:i+3]=bytes([gray])*3
   assert actual==expected;checks+=1
 image=Image.open(root/f['png']).convert('RGBA');raw=base64.b64decode(b['layers'][0]['cels'][0]['rgba']);expected=[]
 for i in range(0,len(raw),4):
  gray=(299*raw[i]+587*raw[i+1]+114*raw[i+2]+500)//1000;expected.append((gray,gray,gray,raw[i+3]) if raw[i+3] else (0,0,0,0))
 assert list(image.getdata())==expected;assert image.size==(a['width'],a['height']);checks+=2
result={'status':'passed','version':data['version'],'fixtures':len(data['files']),'checks':checks,'reader':'Python integer formula, base64 source bytes and Pillow PNG'}
(root/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
