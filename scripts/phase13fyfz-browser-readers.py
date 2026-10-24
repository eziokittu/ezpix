import json,base64,struct,zlib
from pathlib import Path
from PIL import Image
root=Path('artifacts/phase13fyfz-ui');manifest=json.loads((root/'result.json').read_text());checks=0
def read_png(path,palette,indices,w,h):
 global checks
 b=path.read_bytes();assert b[:8]==bytes([137,80,78,71,13,10,26,10]);at=8;chunks={}
 while at<len(b):
  n=struct.unpack('>I',b[at:at+4])[0];kind=b[at+4:at+8];raw=b[at+8:at+8+n];assert struct.unpack('>I',b[at+8+n:at+12+n])[0]==zlib.crc32(kind+raw)&0xffffffff;chunks.setdefault(kind,b'');chunks[kind]+=raw;at+=n+12
 assert chunks[b'IHDR'][8:10]==bytes([8,3]);assert chunks[b'PLTE']==bytes(v for c in palette for v in c[:3]);assert chunks[b'tRNS']==bytes(c[3] for c in palette);checks+=3
 scan=zlib.decompress(chunks[b'IDAT']);assert len(scan)==(w+1)*h;assert all(scan[y*(w+1)]==0 for y in range(h));assert list(v for y in range(h) for v in scan[y*(w+1)+1:(y+1)*(w+1)])==indices;checks+=1
 image=Image.open(path);assert image.mode=='P';assert list(image.getdata())==indices;assert list(image.convert('RGBA').getdata())==[tuple(palette[i]) for i in indices];checks+=2

for pair in manifest['downloads']:
 c=json.loads((root/pair['json']).read_text());assert c['format']=='ezpix-indexed-cel' and c['version']==1;assert len(c['palette'])==3;assert c['transparentIndex']==2;checks+=3
 indices=list(base64.b64decode(c['indices']));read_png(root/pair['png'],c['palette'],indices,c['width'],c['height'])
r={'status':'passed','version':manifest['version'],'buildId':manifest['buildId'],'files':len(manifest['downloads'])*2,'checks':checks};(root/'readers.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
