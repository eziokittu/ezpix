"""Read actual browser Tiled ZIP downloads with stdlib codecs, independently of JS."""
import base64
import json
from pathlib import Path
import struct
import zlib
import zipfile

root=Path(__file__).resolve().parents[1]/'artifacts'/'tilemaps'
reports=[]

def png(data):
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    at=8
    compressed=b''
    while at<len(data):
        n=struct.unpack_from('>I',data,at)[0]
        kind=data[at+4:at+8]
        raw=data[at+8:at+8+n]
        assert zlib.crc32(kind+raw)&0xffffffff==struct.unpack_from('>I',data,at+8+n)[0]
        if kind==b'IHDR':
            width,height,bits,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',raw)
            assert (bits,color,compression,filtering,interlace)==(8,6,0,0,0)
        if kind==b'IDAT': compressed+=raw
        at+=12+n
    rows=zlib.decompress(compressed)
    stride=width*4
    assert len(rows)==(stride+1)*height
    assert all(rows[y*(stride+1)]==0 for y in range(height))
    return width,height,b''.join(rows[y*(stride+1)+1:(y+1)*(stride+1)] for y in range(height))

for surface in ['extension','website']:
    path=root/(surface+'-tiled.zip')
    if not path.exists(): continue
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        doc=json.loads(archive.read('source.ezpix'))
        tiled=json.loads(archive.read('map.tmj'))
        maps=[layer for layer in doc['layers'] if 'tilemap' in layer]
        assert doc['version']==17 and len(maps)==len(tiled['layers'])==2
        sets={s['id']:s for s in doc['tilesets']}
        assert len(tiled['tilesets'])==len(sets)==1
        pixels_checked=0
        flags_seen=set()
        for original,exported in zip(sets.values(),tiled['tilesets']):
            w,h,pixels=png(archive.read(exported['image']))
            assert exported['tilecount']==len(original['tiles'])
            tw,th=original['width'],original['height']
            for index,encoded in enumerate(original['tiles']):
                tile=base64.b64decode(encoded,validate=True)
                actual=b''.join(pixels[((index//exported['columns']*th+y)*w+index%exported['columns']*tw)*4:((index//exported['columns']*th+y)*w+index%exported['columns']*tw+tw)*4] for y in range(th))
                assert actual==tile, 'atlas changed hidden RGB or exact duplicate/unused tile bytes'
                pixels_checked+=tw*th
        for layer,output in zip(maps,tiled['layers']):
            m=layer['tilemap']
            original=sets[m['tilesetId']]
            catalog=tiled['tilesets'][list(sets).index(m['tilesetId'])]
            assert output['visible']==layer['visible']
            assert output['opacity']==layer['opacity']/255
            tw,th=original['width'],original['height']
            _,_,atlas=png(archive.read(catalog['image']))
            for index,(tile,flags,gid) in enumerate(zip(m['cells'],m['flags'],output['data'])):
                if tile<0:
                    assert gid==0
                    continue
                assert 0<=gid<=0xffffffff
                decoded=(1 if gid&(1<<31) else 0)|(2 if gid&(1<<30) else 0)|(4 if gid&(1<<29) else 0)
                assert decoded==flags
                assert (gid&0x0fffffff)-catalog['firstgid']==tile
                flags_seen.add(flags)
                # Forward Tiled diagonal then H/V mapping, independent of JS inverse sampling.
                source=base64.b64decode(original['tiles'][tile])
                expected=bytearray(tw*th*4)
                for sy in range(th):
                    for sx in range(tw):
                        dx,dy=(sy,sx) if flags&4 else (sx,sy)
                        if flags&1: dx=tw-1-dx
                        if flags&2: dy=th-1-dy
                        expected[(dy*tw+dx)*4:(dy*tw+dx+1)*4]=source[(sy*tw+sx)*4:(sy*tw+sx+1)*4]
                reconstructed=bytearray(tw*th*4)
                for dy in range(th):
                    for dx in range(tw):
                        x=tw-1-dx if gid&(1<<31) else dx
                        y=th-1-dy if gid&(1<<30) else dy
                        if gid&(1<<29): x,y=y,x
                        ox=(tile%catalog['columns'])*tw+x
                        oy=(tile//catalog['columns'])*th+y
                        start=(oy*catalog['imagewidth']+ox)*4
                        reconstructed[(dy*tw+dx)*4:(dy*tw+dx+1)*4]=atlas[start:start+4]
                assert reconstructed==expected
        assert flags_seen==set(range(8)),flags_seen
        reports.append({'surface':surface,'tilePixels':pixels_checked,'transforms':sorted(flags_seen),'zipCrc':True,'exactHiddenRgbAndIds':True})
assert reports
(root/'independent-result.json').write_text(json.dumps(reports,indent=2)+'\n')
print('PASS independent ZIP/PNG/hidden RGB/slot/global-ID/all-eight-transform checks:',len(reports),'surfaces')
