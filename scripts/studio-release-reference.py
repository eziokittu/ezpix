"""Independent PNG/ZIP/pixel checks of real studio downloads. No EzPix runtime imports."""
from pathlib import Path
from fractions import Fraction
from PIL import Image
import base64, io, json, struct, zipfile, zlib

root=Path(__file__).resolve().parents[1]
out=root/'artifacts/studio-release'
p=json.loads((out/'layers-animation.ezpix').read_text())
w,h=p['width'],p['height']

def frame_pixels(frame):
    planes=[]
    for layer in p['layers']:
        if not layer['visible']:continue
        cels={c['frameId']:c for c in layer['cels']}
        cel=cels[frame]
        while 'linkedTo' in cel:cel=cels[cel['linkedTo']]
        pixels=base64.b64decode(cel.get('rgba',''))
        if not pixels:pixels=bytes(w*h*4)
        planes.append((pixels,layer['opacity']))
    output=bytearray()
    for i in range(w*h):
        rgb=[Fraction(0)]*3;a=Fraction(0)
        for pixels,opacity in planes:
            s=Fraction(pixels[i*4+3]*opacity,65025)
            rgb=[pixels[i*4+c]*s+rgb[c]*(1-s) for c in range(3)]
            a=s+a*(1-s)
        rnd=lambda v:(v.numerator*2+v.denominator)//(v.denominator*2)
        output.extend([rnd(c/a) if a else 0 for c in rgb]+[rnd(a*255)])
    return bytes(output)

expected=[frame_pixels(f['id']) for f in p['frames']]
png=Image.open(out/'export-png.png');assert png.size==(w,h);assert png.convert('RGBA').tobytes()==expected[1]
apng=Image.open(out/'export-apng.png');assert apng.n_frames==2
for i in range(2):apng.seek(i);assert apng.convert('RGBA').tobytes()==expected[i];assert apng.info['duration']==p['frames'][i]['duration']
gif=Image.open(out/'export-gif.gif');assert gif.n_frames==2
for i in range(2):gif.seek(i);assert gif.convert('RGBA').tobytes()==expected[i];assert gif.info['duration']==p['frames'][i]['duration']
zip_images=0
for kind in ['frames','atlas']:
    with zipfile.ZipFile(out/f'export-{kind}.zip') as archive:
        assert archive.testzip() is None
        metadata=json.loads(archive.read('assets.json'))
        if kind=='frames':
            for i in range(2):
                name=f'images/region-1-frame-{i+1}.png'
                assert Image.open(io.BytesIO(archive.read(name))).convert('RGBA').tobytes()==expected[i]
                zip_images+=1
        else:
            atlas=Image.open(io.BytesIO(archive.read('atlas.png'))).convert('RGBA')
            assert atlas.crop((0,0,w,h)).tobytes()==expected[0]
            assert atlas.crop((w,0,w*2,h)).tobytes()==expected[1]
            zip_images+=2

def raw_png(path):
    data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';at=8;chunks={};idat=b''
    while at<len(data):
        size=struct.unpack('>I',data[at:at+4])[0];kind=data[at+4:at+8];payload=data[at+8:at+8+size]
        assert zlib.crc32(kind+payload)==struct.unpack('>I',data[at+8+size:at+12+size])[0]
        if kind==b'IDAT':idat+=payload
        else:chunks[kind]=payload
        at+=12+size
    width,height,depth,mode,compression,filtering,interlace=struct.unpack('>IIBBBBB',chunks[b'IHDR'])
    assert (depth,mode,compression,filtering,interlace)==(8,3,0,0,0)
    table=chunks[b'PLTE'];alpha=chunks.get(b'tRNS',b'');palette=[list(table[i:i+3])+[alpha[i//3] if i//3<len(alpha) else 255] for i in range(0,len(table),3)]
    scan=zlib.decompress(idat);pixels=bytearray(width*height)
    for y in range(height):
        f=scan[y*(width+1)];assert f<=4
        for x in range(width):
            a=pixels[y*width+x-1] if x else 0;b=pixels[(y-1)*width+x] if y else 0;c=pixels[(y-1)*width+x-1] if x and y else 0
            t=a+b-c;dist=[abs(t-a),abs(t-b),abs(t-c)];paeth=[a,b,c][dist.index(min(dist))]
            predict=[0,a,b,(a+b)//2,paeth][f]
            pixels[y*width+x]=(scan[y*(width+1)+x+1]+predict)&255
    return width,height,palette,bytes(pixels)

source=raw_png(out/'raw-source.png');browser=raw_png(out/'raw-browser-export.png');assert source==browser
assert source[2]==[[11,22,33,0],[80,90,100,255],[80,90,100,255],[44,55,66,0],[1,2,3,127],[99,88,77,255]]
assert source[3]==bytes(i%5 for i in range(257*3))
report={'status':'passed','studioFrames':2,'zipFrameChecks':zip_images,'rawSlots':len(source[3]),'paletteSlots':len(source[2]),'readers':['Pillow PNG/APNG/GIF','Python zipfile CRC','independent rational compositing','stdlib PNG chunk/CRC/zlib/filter reader']}
(out/'independent-result.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
