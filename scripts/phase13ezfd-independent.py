"""Independent Pillow writers/readers, struct directory checks, and Fraction APNG oracle."""
from pathlib import Path
from PIL import Image
from fractions import Fraction
import struct,zlib,json,sys,io,random
out=Path(sys.argv[2]) if len(sys.argv)>2 and sys.argv[1]=='downloads' else Path('artifacts/phase13ezfd');out.mkdir(parents=True,exist_ok=True)
def rgba(im):return list(im.convert('RGBA').tobytes())
def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
def png(w,h,p):return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+bytes(p[y*w*4:(y+1)*w*4]) for y in range(h))))+chunk(b'IEND',b'')
def rnd(v):return (v.numerator*2+v.denominator)//(2*v.denominator)
if len(sys.argv)>1 and sys.argv[1]=='fixtures':
 fixtures=[];im=Image.new('RGBA',(7,5));im.putdata([((i*19)%256,(i*47)%256,(i*83)%256,[0,1,128,255][i%4]) for i in range(35)])
 for mode,ext in [('RGBA','tga'),('RGB','pcx'),('P','pcx')]:
  src=im.convert(mode);name='pillow-'+mode+'.'+ext;src.save(out/name);fixtures.append(dict(file=name,frames=[rgba(Image.open(out/name))]))
 im.save(out/'pillow-rle.tga',compression='tga_rle');fixtures.append(dict(file='pillow-rle.tga',frames=[rgba(Image.open(out/'pillow-rle.tga'))]))
 icon=Image.new('RGBA',(64,64));icon.putdata([((i*19)%256,(i*47)%256,(i*83)%256,[0,1,128,255][i%4]) for i in range(4096)]);icon.save(out/'pillow.ico',sizes=[(16,16),(32,32),(64,64)])
 b=(out/'pillow.ico').read_bytes();count=struct.unpack_from('<H',b,4)[0];entries=[]
 cur=bytearray(b);struct.pack_into('<H',cur,2,2)
 for i in range(count):
  w,h,_,_,_,_,length,offset=struct.unpack_from('<BBBBHHII',b,6+i*16);w=w or 256;h=h or 256;pixels=rgba(Image.open(io.BytesIO(b[offset:offset+length])));entries.append(dict(width=w,height=h,pixels=pixels,hotspot=[i+1,i+2]));struct.pack_into('<HH',cur,10+i*16,i+1,i+2)
 (out/'pillow.cur').write_bytes(cur)
 for ext in ['ico','cur']:fixtures.append(dict(file='pillow.'+ext,entries=entries))
 # Pillow APNG default fallback and disposal examples use full source replacement.
 animation=[]
 for f in range(4):
  a=Image.new('RGBA',(7,5),(f*50,255-f*30,40+f*20,255));a.putpixel((f,1),(0,0,0,0));animation.append(a)
 for fallback in [False,True]:
  file='pillow-'+str(fallback)+'.apng';animation[0].save(out/file,format='PNG',save_all=True,append_images=animation[1:],default_image=fallback,duration=[37,123,240,90],disposal=[0,1,2,0],blend=[0,0,0,0],loop=3)
  decoded=Image.open(out/file);frames=[];dur=[]
  for f in range(1 if fallback else 0,decoded.n_frames):decoded.seek(f);frames.append(rgba(decoded));dur.append(round(decoded.info['duration']))
  fixtures.append(dict(file=file,frames=frames,durations=dur))
 randomizer=random.Random(198202)
 for case in range(32):
  w,h=5,4;canvas=[0]*(w*h*4);parts=[png(w,h,canvas)[:33],chunk(b'acTL',struct.pack('>II',5,2))];frames=[];dur=[];sequence=0;prior=None;restore=None
  for f in range(5):
   if prior:
    x,y,fw,fh,dispose=prior
    if dispose==1:
     for yy in range(y,y+fh):
      for xx in range(x,x+fw):canvas[(yy*w+xx)*4:(yy*w+xx+1)*4]=[0,0,0,0]
    elif dispose==2:canvas=restore.copy()
   fw=w if f==0 else randomizer.randrange(1,w+1);fh=h if f==0 else randomizer.randrange(1,h+1);x=randomizer.randrange(w-fw+1);y=randomizer.randrange(h-fh+1);dispose=randomizer.randrange(3);blend=randomizer.randrange(2);source=[randomizer.randrange(256) for i in range(fw*fh*4)];num=[0,1,37,123,65535][f];den=[0,3,1000,1000,1][f]
   restore=canvas.copy()
   for yy in range(fh):
    for xx in range(fw):
     i=(yy*fw+xx)*4;j=((y+yy)*w+x+xx)*4;s=source[i:i+4];d=canvas[j:j+4]
     if not blend:canvas[j:j+4]=s
     else:
      sa=Fraction(s[3],255);da=Fraction(d[3],255);alpha=sa+da*(1-sa)
      canvas[j:j+4]=[rnd((s[c]*sa+d[c]*da*(1-sa))/alpha) for c in range(3)]+[rnd(alpha*255)] if alpha else [0,0,0,0]
   control=struct.pack('>IIIIIHHBB',sequence,fw,fh,x,y,num,den,dispose,blend);parts.append(chunk(b'fcTL',control));sequence+=1;data=png(fw,fh,source);raw=data[41:-16]
   if f==0:parts.append(chunk(b'IDAT',raw))
   else:parts.append(chunk(b'fdAT',struct.pack('>I',sequence)+raw));sequence+=1
   frames.append(canvas.copy());dur.append(max(20,min(5000,rnd(Fraction(num*1000,den or 100)))));prior=x,y,fw,fh,dispose
  parts.append(chunk(b'IEND',b''));file='fraction-'+str(case)+'.apng';(out/file).write_bytes(b''.join(parts));fixtures.append(dict(file=file,frames=frames,durations=dur))
 (out/'fixtures.json').write_text(json.dumps(fixtures));print('Created Pillow and Fraction fixtures')
else:
 entries=json.loads((out/'exports.json').read_text());checks=0
 for e in entries:
  file=out/e['file'];b=file.read_bytes()
  if file.suffix in ['.ico','.cur']:
   reserved,kind,count=struct.unpack_from('<HHH',b);assert reserved==0 and kind==(2 if file.suffix=='.cur' else 1) and count==1
   w,h,colors,reserved,a,c,length,offset=struct.unpack_from('<BBBBHHII',b,6);assert (w or 256,h or 256)==(e['width'],e['height']);assert offset==22 and offset+length==len(b)
   if kind==2:assert [a,c]==e['hotspot']
   else:assert [a,c]==[1,32]
   decoded=Image.open(io.BytesIO(b[offset:offset+length]))
  else:decoded=Image.open(file)
  assert decoded.size==(e['width'],e['height']);expected=e['pixels'].copy()
  if file.suffix=='.pcx':
   for i in range(0,len(expected),4):
    a=expected[i+3]
    for c in range(3):expected[i+c]=(expected[i+c]*a+255*(255-a)+127)//255
    expected[i+3]=255
  assert rgba(decoded)==expected,file;checks+=1
 print(json.dumps(dict(status='passed',exportChecks=checks,readers='Pillow plus independent ICO/CUR struct/PNG readers')))
