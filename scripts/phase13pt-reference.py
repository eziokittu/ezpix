import json,sys,base64
cases=json.load(open(sys.argv[1],encoding='utf-8'))
for c in cases:
 w,h,sw,sh=c['w'],c['h'],c['sw'],c['sh'];o=c['options'];raw=base64.b64decode(c['source']);before=[bytearray(base64.b64decode(b) or bytes(w*h*4)) for b in c['before']]
 for f in range(4):
  result=before[f][:] if o['destination']=='cel' else bytearray(w*h*4)
  if (f in (0,1) if o['destination']=='cel' else f==0):
   for y in range(sh):
    at=((o['y']+y)*w+o['x'])*4;result[at:at+sw*4]=raw[y*sw*4:(y+1)*sw*4]
  actual=base64.b64decode(c['after'][f]) or bytes(w*h*4);assert bytes(result)==actual
 if o['destination']=='new-layer':assert c['retained']==c['before']
print(json.dumps({'status':'passed','cases':len(cases),'oracle':'Python RGBA row replacement and independent target-frame rules; raw source frame/layer extracted separately'}))
