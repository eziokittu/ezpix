import json,base64,struct,zlib,sys,zipfile
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

def planes(project):
 result={}
 for layer in project['layers']:
  cels={}
  for c in layer['cels']:
   if 'link' in c:cels[c['frameId']]=cels[c['link']]
   elif project.get('indexed'):
    if c.get('empty'):indices=[project['indexed']['transparentIndex']]*(project['width']*project['height'])
    else:indices=list(base64.b64decode(c['indices']))
    cels[c['frameId']]=bytes(v for i in indices for v in project['indexed']['palette'][i])
   else:cels[c['frameId']]=bytes(project['width']*project['height']*4) if c.get('empty') else base64.b64decode(c['rgba'])
  result[layer['id']]=cels
 return result
for f in manifest['fixtures']:
 text=(root/f['project']).read_text();p=json.loads(text);b=f['before'];assert p['version']==16 and p['indexed'];assert 'editingMode' not in p and 'outputMode' not in p;checks+=2
 assert planes(p)==planes(b);assert p['palette']==b['palette'];checks+=2
 for layer in p['layers']:
  assert all('rgba' not in c for c in layer['cels']);checks+=1
 assert p['indexed']['palette'][0]==p['indexed']['palette'][3];assert p['indexed']['transparentIndex']==4;checks+=2
 raw=json.loads((root/f['raw']).read_text());indices=list(base64.b64decode(raw['indices']));assert raw['palette']==p['indexed']['palette'];assert raw['transparentIndex']==p['indexed']['transparentIndex'];assert indices[0]==3;checks+=3
 read_png(root/f['png'],raw['palette'],indices,raw['width'],raw['height'])
 w=json.loads((root/f['workspace']).read_text());assert w['documents'][0]['project']==text;checks+=1
 lib=json.loads((root/f['library']).read_text());assert lib['entries'][0]['project']==text;checks+=1
 with zipfile.ZipFile(root/f['zip']) as z:
  z.testzip();files=[name for name in z.namelist() if name.endswith('.ezpix')];assert len(files)==1;assert z.read(files[0]).decode()==text;checks+=2
r={'status':'passed','version':manifest['version'],'fixtures':len(manifest['fixtures']),'checks':checks,'reader':'Python indexed v16 planes, PNG CRC/zlib/Pillow, workspace/library/ZIP'};(root/'result.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
