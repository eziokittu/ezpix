"""Independent ZIP/PNG/APNG reader, including APNG CRC/sequence/delay and exact Pillow frames."""
import json,sys,io,zipfile,struct,zlib,xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);data=json.loads((root/'expected.json').read_text());count=0
for case in data:
    scale=case.get("scale",1);size=(case["width"]*scale,case["height"]*scale)
    scaled=[list(Image.frombytes("RGBA",(case["width"],case["height"]),bytes(raw)).resize(size,Image.Resampling.NEAREST).tobytes()) for raw in case["frames"]]
    png=(root/case['apng']).read_bytes();at=8;sequence=0;delays=[];controls=[]
    while at<len(png):
        n=struct.unpack_from('>I',png,at)[0];kind=png[at+4:at+8];chunk=png[at+8:at+8+n];crc=struct.unpack_from('>I',png,at+8+n)[0];assert zlib.crc32(kind+chunk)&0xffffffff==crc
        if kind==b'acTL':assert struct.unpack('>II',chunk)==(len(case['order']),case['plays'])
        if kind in (b'fcTL',b'fdAT'):assert struct.unpack_from('>I',chunk)[0]==sequence;sequence+=1
        if kind==b'fcTL':
            _,w,h,x,y,num,den,dispose,blend=struct.unpack('>IIIIIHHBB',chunk);assert (w,h,x,y,den,dispose,blend)==(*size,0,0,1000,0,0);delays.append(num);controls.append(kind)
        at+=n+12
    assert at==len(png) and delays==case['durations']
    im=Image.open(io.BytesIO(png));assert im.n_frames==len(case['order'])
    for i,source in enumerate(case['order']):
        im.seek(i);assert list(im.convert('RGBA').tobytes())==scaled[source];assert abs(im.info['duration']-case['durations'][i])<.001;count+=1
    with zipfile.ZipFile(root/case['atlas']) as z:
        assert z.testzip() is None;meta=json.loads(z.read('assets.json'));atlas=Image.open(io.BytesIO(z.read('atlas.png'))).convert('RGBA')
        for i,f in enumerate(meta['frames']):
            raw=list(atlas.crop((f['x'],f['y'],f['x']+f['width'],f['y']+f['height'])).tobytes());assert raw==scaled[i];count+=1
            for s in f['slices']:assert (s['pivotX'],s['pivotY'])==tuple(v*scale for v in case.get('pivot',[-2,5]))
        assert 'references' not in meta and 'conversion' not in meta and meta['paletteOrganisation']['locked']==[0]
    if case.get('ora'):
        with zipfile.ZipFile(root/case['ora']) as z:
            layers=ET.fromstring(z.read('stack.xml')).find('stack').findall('layer')[::-1]
            assert len(layers)==len(case['frames'])
            for i,l in enumerate(layers):assert list(Image.open(io.BytesIO(z.read(l.attrib['src']))).convert('RGBA').tobytes())==case['frames'][i];count+=1
    with zipfile.ZipFile(root/case['batch']) as z:
        assert z.testzip() is None;assert len(z.namelist())<=40;assert 'batch.json' in z.namelist();assert all('..' not in p.split('/') and not p.startswith('/') for p in z.namelist());count+=1
        for path in z.namelist():
            if not path.endswith('/assets.json'):continue
            manifest=json.loads(z.read(path));prefix=path[:-len('assets.json')]
            for image in manifest.get('images',[]):
                index=int(image['sourceFrameId'].split('-')[1])-1;r=image['region']
                source=Image.frombytes('RGBA',(case['width'],case['height']),bytes(case['frames'][index]))
                expected=source.crop((r['x'],r['y'],r['x']+r['width'],r['y']+r['height'])).resize((r['width']*scale,r['height']*scale),Image.Resampling.NEAREST)
                actual=Image.open(io.BytesIO(z.read(prefix+image['image']))).convert('RGBA')
                assert actual.size==expected.size and actual.tobytes()==expected.tobytes()
                assert image['pivot']=={'x':r['pivotX']*scale,'y':r['pivotY']*scale};count+=1

json.dump({'status':'passed','checks':count,'cases':len(data),'readers':['Pillow APNG/PNG','Python zipfile struct zlib'],'checksDescription':['APNG CRCs, control sequences, exact RGBA and milliseconds','atlas cells, slice PNG crops/scaling/pivots and safe ZIP paths','palette metadata retained, reference/source data omitted']},sys.stdout)
