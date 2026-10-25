"""Original binary fixtures and an independent struct/zlib native reader."""
import struct as S, zlib, json, sys, base64
from pathlib import Path
out=Path('artifacts/phase13hoih-independent');out.mkdir(parents=True,exist_ok=True)
def pack(fmt,*v):return S.pack('<'+fmt,*v)
def text(s):
 b=s.encode();return pack('H',len(b))+b
def chunk(t,b):return pack('IH',len(b)+6,t)+b
def generate():
 cases=[]
 for depth in [8,32]:
  for n in range(24):
   w,h=3+n%5,2+n%3;size=5+n%4;transparent=n%size
   colors=[[i*29%256,i*43%256,i*61%256,255 if i%3 else 127] for i in range(size)]
   colors[2]=colors[1][:];colors[transparent]=[13,27,49,0]
   if depth==32:colors=[p[:3]+[255] for p in colors]
   mode=n%4;direction=[0,0,1,2][mode];repeat=1 if mode==1 else 0
   tag=chunk(0x2018,pack('H',1)+bytes(8)+pack('HHBH',0,2,direction,repeat)+bytes(10)+text('Run'))
   sl=chunk(0x2022,pack('III',1,2,0)+text('Body')+pack('IiiIIii',0,0,0,w,h,-3,5))
   palette=chunk(0x2019,pack('III',size,0,size-1)+bytes(8)+b''.join(pack('H4B',0,*p) for p in colors))
   flags=1|(0 if n%2 else 2);opacity=[255,73,128][n%3]
   layer=chunk(0x2004,pack('HHHHHHB',flags,0,0,0,0,0,opacity)+bytes(3)+text('Pixels'))
   planes=[];framebytes=[];raw=None
   for f in range(3):
    if f==1:
     cel=chunk(0x2005,pack('HhhBHh',0,0,0,255,1,0)+bytes(5)+pack('H',0));plane=planes[0]
    else:
     plane=[(i+f+n)%size for i in range(w*h)] if depth==8 else [(i*19+f*23+n)%256 for i in range(w*h*4)]
     raw=bytes(plane);ctype=2 if n%2 else 0
     cel=chunk(0x2005,pack('HhhBHh',0,0,0,255,ctype,0)+bytes(5)+pack('HH',w,h)+(zlib.compress(raw) if ctype==2 else raw))
    planes.append(plane)
    chunks=[layer,palette,tag,sl,cel] if f==0 else [cel];body=b''.join(chunks)
    framebytes.append(pack('IHHHHI',len(body)+16,0xf1fa,len(chunks),[80,140,200][f],0,len(chunks))+body)
   body=b''.join(framebytes);header=pack('IHHHHHIH',len(body)+128,0xa5e0,3,w,h,depth,1,80)+bytes(8)+pack('B',transparent)+bytes(3)+pack('HBB',size,1,1)+bytes(92)
   filename=f'original-{depth}-{n}.aseprite';(out/filename).write_bytes(header+body)
   cases.append(dict(file=filename,depth=depth,width=w,height=h,palette=colors,transparent=transparent,planes=planes,opacity=opacity,locked=not bool(flags&2),mode=['loop','once','reverse','ping-pong'][mode]))
 (out/'cases.json').write_text(json.dumps(cases))
 print('Generated',len(cases),'original struct/zlib fixtures')
def read_native(path):
 b=path.read_bytes();size,magic,frames,w,h,depth=S.unpack_from('<I5H',b);assert size==len(b) and magic==0xa5e0
 palette=None;layers=[];planes=[];types=[];tags=[];slices=[];at=128
 for f in range(frames):
  n,magic,old,duration,_,count=S.unpack_from('<I4HI',b,at)
  assert magic==0xf1fa;end=at+n;c=at+16;current={};ct=[]
  for _ in range(count or old):
   length,t=S.unpack_from('<IH',b,c);p=b[c+6:c+length];assert length>=6 and c+length<=end
   if t==0x2004:
    lf,lt,level,_,_,blend,opacity=S.unpack_from('<6HB',p);ln=S.unpack_from('<H',p,16)[0];layers.append(dict(flags=lf,opacity=opacity,name=p[18:18+ln].decode()));assert lt==level==blend==0
   elif t==0x2019:
    size,first,last=S.unpack_from('<3I',p);assert first==0 and last==size-1;palette=[list(S.unpack_from('<4B',p,22+i*6)) for i in range(size)]
   elif t==0x2005:
    l,x,y,opacity,ctype,z=S.unpack_from('<HhhBHh',p);assert x==y==z==0 and opacity==255
    if ctype==1:
     target=S.unpack_from('<H',p,16)[0];assert target<f;data=planes[target][l]
    else:
     cw,ch=S.unpack_from('<HH',p,16);assert (cw,ch)==(w,h);raw=p[20:] if ctype==0 else zlib.decompress(p[20:]);assert len(raw)==w*h*(1 if depth==8 else 4);data=list(raw)
    current[l]=data;ct.append(ctype)
   elif t==0x2018:
    count=S.unpack_from('<H',p)[0];pos=10
    for i in range(count):
     start,tag_end,direction,repeat=S.unpack_from('<HHBH',p,pos);ln=S.unpack_from('<H',p,pos+17)[0];tags.append(dict(start=start,end=tag_end,direction=direction,repeat=repeat,name=p[pos+19:pos+19+ln].decode()));pos+=19+ln
   elif t==0x2022:
    count,flags,_=S.unpack_from('<3I',p);ln=S.unpack_from('<H',p,12)[0];label=p[14:14+ln].decode();values=S.unpack_from('<IiiIIii',p,14+ln);slices.append(dict(name=label,values=list(values)));assert count==1 and flags==2
   c+=length
  assert c==end;planes.append(current);types.append(ct);at=end
 assert at==len(b)
 return dict(width=w,height=h,depth=depth,palette=palette,layers=layers,planes=planes,types=types,tags=tags,slices=slices)
def verify():
 checks=0;cases=json.loads((out/'cases.json').read_text())
 for c in cases:
  r=read_native(out/('export-'+c['file']));assert (r['width'],r['height'],r['depth'])==(c['width'],c['height'],c['depth']);checks+=1
  assert r['palette']==c['palette'];checks+=1
  assert [r['planes'][f][0] for f in range(3)]==c['planes'];checks+=1
  assert r['types']==[[0],[1],[0]];checks+=1
  assert r['layers'][0]['opacity']==c['opacity'] and bool(r['layers'][0]['flags']&2)!=c['locked'];checks+=1
  assert r['tags'][0]==dict(start=0,end=2,direction={'loop':0,'once':0,'reverse':1,'ping-pong':2}[c['mode']],repeat=1 if c['mode']=='once' else 0,name='Run');checks+=1
  assert r['slices']==[dict(name='Body',values=[0,0,0,c['width'],c['height'],-3,5])];checks+=1
  j=json.loads((out/(c['file']+'.ezpix')).read_text());assert j['version']==16 and j['tags'][0]['mode']==c['mode'];checks+=1
  for f in range(3):
   cel=j['layers'][0]['cels'][f]
   if f==1:assert cel['link']=='frame-1'
   elif c['depth']==8:assert list(base64.b64decode(cel['indices']))==c['planes'][f]
   else:assert list(base64.b64decode(cel['rgba']))==c['planes'][f]
   checks+=1
 result=dict(status='passed',fixtures=len(cases),checks=checks,reader='Python struct/zlib/JSON/base64');(out/'result.json').write_text(json.dumps(result,indent=2));print('PASS',result)
if __name__=='__main__':
 if '--generate' in sys.argv:generate()
 else:verify()
