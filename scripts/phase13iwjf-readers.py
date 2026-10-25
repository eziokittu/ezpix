"""Original ASE binary writer and independent frame-render/project/PNG oracle."""
import json,struct,zlib,base64,math,sys
from pathlib import Path
from PIL import Image
OUT=Path('artifacts/phase13iwjf-independent')
def u16(n):return struct.pack('<H',n&65535)
def u32(n):return struct.pack('<I',n&0xffffffff)
def text(s):b=s.encode();return u16(len(b))+b
def chunk(t,b):return u32(len(b)+6)+u16(t)+b
def pal(table,first=0,last=None):
 last=len(table)-1 if last is None else last
 return chunk(0x2019,u32(len(table))+u32(first)+u32(last)+bytes(8)+b''.join(u16(0)+bytes(p) for p in table[first:last+1]))
def layer(l):return chunk(0x2004,u16((1 if l['visible'] else 0)+2+(8 if l['background'] else 0))+u16(0)+u16(0)+bytes(4)+u16(0)+bytes([l['opacity']])+bytes(3)+text(l['name']))
def cel(c,depth,compressed):
 b=u16(c['layer'])+u16(c['x'])+u16(c['y'])+bytes([c['opacity']])+u16(1 if 'link' in c else 2 if compressed else 0)+u16(c['z'])+bytes(5)
 if 'link' in c:return chunk(0x2005,b+u16(c['link']))
 raw=bytes(v for p in c['pixels'] for v in p) if depth!=8 else bytes(c['pixels'])
 return chunk(0x2005,b+u16(c['width'])+u16(c['height'])+(zlib.compress(raw) if compressed else raw))
def ase(model):
 parts=[]
 for f,frame in enumerate(model['frames']):
  chunks=([layer(l) for l in model['layers']] if f==0 else [])
  if frame.get('palette'):chunks.append(pal(frame['palette'],frame.get('first',0),frame.get('last')))
  if f==0:
   chunks.append(chunk(0x2018,u16(1)+bytes(8)+u16(0)+u16(2)+bytes([2])+u16(0)+bytes(10)+text('Bounce')))
   chunks.append(chunk(0x2022,u32(1)+u32(2)+u32(0)+text('Body')+u32(0)+u32(1)+u32(0)+u32(3)+u32(3)+u32(-1)+u32(4)))
  chunks.extend(cel(c,model['depth'],model['compressed']) for c in frame['cels'])
  body=b''.join(chunks);parts.append(u32(len(body)+16)+u16(0xf1fa)+u16(len(chunks))+u16(frame['duration'])+bytes(2)+u32(len(chunks))+body)
 body=b''.join(parts)
 header=u32(len(body)+128)+u16(0xa5e0)+u16(3)+u16(6)+u16(4)+u16(model['depth'])+u32(1)+u16(100)+bytes(8)+bytes([0])+bytes(3)+u16(5)+bytes([1,1])+bytes(92)
 assert len(header)==128
 return header+body
def render(model):
 outputs=[];images=[];table=None
 for f,frame in enumerate(model['frames']):
  if frame.get('palette'):table=frame['palette']
  seen={};images.append(seen)
  for cel in frame['cels']:
   c=dict(cel)
   if 'link' in c:
    prior=images[c['link']][c['layer']];c.update(width=prior['width'],height=prior['height'],pixels=prior['pixels'])
   seen[c['layer']]=c
  order=sorted(seen,key=lambda i:(i+seen[i]['z'],seen[i]['z']));out=[]
  for y in range(4):
   for x in range(6):
    rgba=[0.,0.,0.];alpha=0.
    for i in order:
     layer=model['layers'][i];c=seen[i];sx,sy=x-c['x'],y-c['y']
     if not layer['visible'] or not (0<=sx<c['width'] and 0<=sy<c['height']):continue
     pixel=c['pixels'][sy*c['width']+sx]
     if model['depth']==8:
      p=table[pixel][:]
      if not layer['background'] and pixel==0:p[3]=0
     elif model['depth']==16:p=[pixel[0]]*3+[pixel[1]]
     else:p=pixel
     opacity=(layer['opacity']*c['opacity']+127)//255;sa=p[3]/255*opacity/255
     rgba=[p[k]*sa+rgba[k]*(1-sa) for k in range(3)];alpha=sa+alpha*(1-sa)
    out.extend([math.floor(v/alpha+.5) for v in rgba]+[math.floor(alpha*255+.5)] if alpha else [0,0,0,0])
  outputs.append(out)
 return outputs

def generate():
 OUT.mkdir(parents=True,exist_ok=True);cases=[]
 for depth in [8,16,32]:
  for z in [-1,0,1]:
   for offset in [-1,0,2]:
    for compressed in [False,True]:
     layers=[dict(name='Background',visible=True,background=depth==8,opacity=153),dict(name='Front',visible=True,background=False,opacity=222),dict(name='Hidden',visible=False,background=False,opacity=255)]
     table=[[11,22,33,255],[70,80,90,255],[70,80,90,255],[123,45,67,128],[200,100,50,0]]
     frames=[]
     for f,duration in enumerate([100,140,200]):
      colors=[p[:] for p in table]
      if f:colors.append([50,180,220,255]);colors[1]=[200,20,30,255] if f==1 else [30,200,20,255]
      cells=[]
      for l in range(3 if f<2 else 2):
       c=dict(layer=l,x=offset+(1 if f==1 else 0),y=-1 if f==2 else 0,z=z if l==0 else 0,opacity=[208,128,64][f])
       if f:c['link']=f-1
       else:
        c.update(width=6,height=4)
        c['pixels']=[(i+l)%5 for i in range(24)] if depth==8 else [[(i*37+l*50)%256,[0,64,128,255][i%4]] for i in range(24)] if depth==16 else [[(i*31+l*70)%256,(i*17)%256,(i*7+90)%256,[0,64,128,255][i%4]] for i in range(24)]
       cells.append(c)
      frame=dict(duration=duration,cels=cells)
      if depth==8:frame['palette']=colors
      if depth==8 and f==2:frame.update(first=1,last=1)
      frames.append(frame)
     model=dict(depth=depth,compressed=compressed,layers=layers,frames=frames);id=len(cases);filename=f'original-{id}.aseprite';(OUT/filename).write_bytes(ase(model));cases.append(dict(id=id,file=filename,model=model,expected=render(model)))
 version=json.loads(Path('packages/core/package.json').read_text())['version'];(OUT/'cases.json').write_text(json.dumps(dict(version=version,cases=cases)));print('Generated original native render fixtures',len(cases))
def read_cel(j,f):return list(base64.b64decode(j['layers'][0]['cels'][f]['rgba']))
def verify_project(j,c):
 assert j['version']==16 and j['width']==6 and j['height']==4
 assert len(j['layers'])==1 and 'indexed' not in j
 assert j['layers'][0]['opacity']==255 and not j['layers'][0]['locked']
 assert [f['duration'] for f in j['frames']]==[100,140,200]
 assert j['tags'][0]['mode']=='ping-pong' and j['tags'][0]['from']==0 and j['tags'][0]['to']==2
 assert j['slices'][0]==dict(id='slice-1',name='Body',x=1,y=0,width=3,height=3,pivotX=-1,pivotY=4)
 for f in range(3):assert read_cel(j,f)==c['expected'][f]
 return 10
def verify():
 meta=json.loads((OUT/'cases.json').read_text());checks=0
 for c in meta['cases']:
  checks+=verify_project(json.loads((OUT/f"case-{c['id']}.ezpix").read_text()),c)
  for f in range(3):
   im=Image.open(OUT/f"case-{c['id']}-{f}.png");assert im.size==(6,4) and list(im.convert('RGBA').tobytes())==c['expected'][f];checks+=2
  actual=json.loads((OUT/f"case-{c['id']}-roundtrip.json").read_text());assert actual==c['expected'];checks+=3
 result=dict(status='passed',version=meta['version'],fixtures=len(meta['cases']),checks=checks,reader='Independent original ASE writer, normal source-over oracle, JSON/base64 and Pillow PNG');(OUT/'result.json').write_text(json.dumps(result,indent=2));print('PASS native rendered fixture readers',result)
if __name__=='__main__':generate() if '--generate' in sys.argv else verify()
