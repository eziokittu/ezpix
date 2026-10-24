import json,base64,struct,zlib,sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);manifest=json.loads((root/'fixtures.json').read_text());checks=0
def read_png(path,palette,indices,w,h):
 global checks
 b=path.read_bytes();assert b[:8]==bytes([137,80,78,71,13,10,26,10]);at=8;chunks={}
 while at<len(b):
  n=struct.unpack('>I',b[at:at+4])[0];kind=b[at+4:at+8];raw=b[at+8:at+8+n];assert struct.unpack('>I',b[at+8+n:at+12+n])[0]==zlib.crc32(kind+raw)&0xffffffff;chunks.setdefault(kind,b'');chunks[kind]+=raw;at+=n+12
 assert chunks[b'IHDR'][8:10]==bytes([8,3]);assert chunks[b'PLTE']==bytes(v for c in palette for v in c[:3]);assert chunks[b'tRNS']==bytes(c[3] for c in palette);checks+=3
 scan=zlib.decompress(chunks[b'IDAT']);assert len(scan)==(w+1)*h;assert all(scan[y*(w+1)]==0 for y in range(h));assert list(v for y in range(h) for v in scan[y*(w+1)+1:(y+1)*(w+1)])==indices;checks+=1
 image=Image.open(path);assert image.mode=='P';assert list(image.getdata())==indices;assert list(image.convert('RGBA').getdata())==[tuple(palette[i]) for i in indices];checks+=2
for f in manifest['fixtures']:
 c=json.loads((root/f['file']).read_text());assert c['format']=='ezpix-indexed-cel' and c['version']==1;assert c['palette']==f['palette'];assert list(base64.b64decode(c['indices']))==f['indices'];assert c['transparentIndex']==1;checks+=4
 read_png(root/f['png'],f['palette'],f['indices'],f['width'],f['height']);r=json.loads((root/f['reordered']).read_text());ri=list(base64.b64decode(r['indices']));assert r['palette']==list(reversed(f['palette']));assert ri==[len(f['palette'])-1-i for i in f['indices']];assert r['transparentIndex']==len(f['palette'])-2;assert [r['palette'][i] for i in ri]==[f['palette'][i] for i in f['indices']];checks+=4
 read_png(root/f['reorderedPng'],r['palette'],ri,f['width'],f['height'])
r={'status':'passed','version':manifest['version'],'fixtures':len(manifest['fixtures']),'checks':checks,'reader':'Python strict slots, zlib scanlines/CRC and Pillow palette/RGBA'};(root/'result.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
