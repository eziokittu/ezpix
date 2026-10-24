from pathlib import Path
import json,base64
root=Path('artifacts/phase13frfx-ui');r=json.loads((root/'result.json').read_text());checks=0
for name in r['downloads']:
 p=json.loads((root/name).read_text());assert p['version']==15 and p['editingMode']=='grayscale';checks+=1
 assert p['palette']==['#000000','#000000','#4c4c4c'];checks+=1
 raw=base64.b64decode(p['layers'][0]['cels'][0]['rgba']);assert raw[:8]==bytes([76,76,76,128,150,150,150,0]);checks+=1
 for layer in p['layers']:
  for cel in layer['cels']:
   if 'rgba' not in cel:continue
   b=base64.b64decode(cel['rgba']);assert all(b[i]==b[i+1]==b[i+2] for i in range(0,len(b),4))
 checks+=1
result={'status':'passed','version':r['version'],'buildId':r['buildId'],'files':len(r['downloads']),'checks':checks};(root/'readers.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
