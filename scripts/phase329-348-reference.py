import json,base64,sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);cases=json.loads((root/'independent-cases.json').read_text());pixels=0
def raw(d):
 table=[base64.b64decode(v) for v in d['tiles']];layer=d['layers'][0];cel=dict(layer['cels'][0]['tiles']);out=[]
 for y in range(d['height']):
  for x in range(d['width']):
   tile=table[cel[f'{x//64},{y//64}']] if f'{x//64},{y//64}' in cel else None
   i=((y%64)*64+x%64)*4
   out.append(list(tile[i:i+4]) if tile else layer['background'])
 return out
def maskbits(i):
 bits=[]
 for y in range(7):
  for x in range(7):
   bits.append(int((2*x-6)**2+(2*y-6)**2<=49) if i%2 else int(abs(x-3)+abs(y-3)<=3))
 if i%3==0:
  return [int(v and (x==0 or y==0 or x==6 or y==6 or not all(bits[yy*7+xx] for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]))) for y in range(7) for x in range(7) for v in [bits[y*7+x]]]
 if i%3==1:return [1-v for v in bits]
 return [v^int(abs(j%7-3)+abs(j//7-3)<=3) for j,v in enumerate(bits)]
for case in cases:
 i=case['i'];bits=maskbits(i);actual=[]
 for j,n in enumerate(case['mask']['runs']):actual += [j%2]*n
 assert actual==bits,('independent membership',i)
 before=raw(case['before']);expected=[p[:] for p in before];o=case['edit'];w=24
 if not o['copy']:
  for y in range(7):
   for x in range(7):
    if bits[y*7+x]:expected[(y+3)*w+x+2]=[0,0,0,0]
 for y in range(7):
  for x in range(7):
   sx=6-x if o['flipX'] else x;sy=6-y if o['flipY'] else y
   if bits[sy*7+sx]:expected[(y+o['y'])*w+x+o['x']]=before[(sy+3)*w+sx+2]
 assert raw(case['after'])==expected,('independent raw edit',i)
 decoded=list(Image.open(root/case['png']).convert('RGBA').getdata())
 assert decoded==[tuple(p if p[3] else [0,0,0,0]) for p in expected],('independent PNG',i)
 pixels+=len(expected)
browser_pixels=0
for name,origins in [('diamond-filled',[(10,10)]),('masked-paste',[(10,10),(30,30)])]:
 path=root/(name+'.ezpix')
 if path.exists():
  d=json.loads(path.read_text());actual=raw(d)
  for y in range(d['height']):
   for x in range(d['width']):
    selected=any(ox<=x<ox+5 and oy<=y<oy+5 and abs(x-ox-2)+abs(y-oy-2)<=2 for ox,oy in origins)
    assert actual[y*d['width']+x]==([57,255,20,255] if selected else [0,0,0,0]),('actual browser file',name,x,y)
    browser_pixels+=1
result={'status':'passed','cases':len(cases),'pixels':pixels,'browserPixels':browser_pixels,'checks':['independent membership formula','raw shared-table reconstruction','overlapping source/destination oracle','Pillow PNG decoding','actual browser project pixels when present']}
(root/'independent.json').write_text(json.dumps(result,indent=2));print('PASS '+json.dumps(result))
