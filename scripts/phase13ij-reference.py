import json,sys,base64
cases=json.load(open(sys.argv[1],encoding='utf-8'))
for c in cases:
 w,h=c['w'],c['h'];r,o=c['rect'],c['options'];a=bytearray(base64.b64decode(c['before']) or bytes(w*h*4));coords=set()
 if o['kind']=='fill':coords={(x,y) for y in range(r['y'],r['y']+r['height']) for x in range(r['x'],r['x']+r['width'])}
 else:
  t=o['thickness'];left,top=r['x'],r['y'];right,bottom=left+r['width'],top+r['height']
  for y in range(top,bottom):
   for x in range(left,min(right,left+t)):coords.add((x,y))
   for x in range(max(left,right-t),right):coords.add((x,y))
  for x in range(left,right):
   for y in range(top,min(bottom,top+t)):coords.add((x,y))
   for y in range(max(top,bottom-t),bottom):coords.add((x,y))
 changed=0
 for x,y in coords:
  i=(y*w+x)*4;b=bytes(o['color']);changed+=a[i:i+4]!=b;a[i:i+4]=b
 assert changed==c['changed'],c
 assert bytes(a)==(base64.b64decode(c['after']) or bytes(w*h*4)),c
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python union of four clipped inner border strips; full RGBA arrays and changed-pixel counts'}))
