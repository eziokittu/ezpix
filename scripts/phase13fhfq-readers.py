"""Independent integer source conversion and Python ZIP/Pillow workspace readers."""
import sys,json,base64,zipfile,io
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);data=json.loads((root/'downloads.json').read_text());count=0
def cel_values(layer):
    result={}
    for cel in layer['cels']:
        result[cel['frameId']]=result[cel['link']] if 'link' in cel else base64.b64decode(cel['rgba']) if 'rgba' in cel else b''
    return result
for case in data:
    before=case['grayBefore'];after=json.loads((root/case['gray']).read_text());assert after.get('outputMode') is None
    assert before['frames']==after['frames'] and before['references']==after['references']
    for old,new in zip(before['layers'],after['layers']):
        original=cel_values(old);converted=cel_values(new)
        for frame,pixels in original.items():
            expected=bytearray(pixels)
            for at in range(0,len(pixels),4):
                gray=(299*pixels[at]+587*pixels[at+1]+114*pixels[at+2]+500)//1000
                expected[at:at+3]=bytes([gray]*3)
            assert converted[frame]==expected;count+=1
        if 'text' in old:
            c=old['text']['color'];gray=(299*c[0]+587*c[1]+114*c[2]+500)//1000
            assert new['text']['color']==[gray,gray,gray,c[3]];count+=1
    for i,c in enumerate(before['palette']):
        r,g,b=[int(c[k:k+2],16) for k in (1,3,5)];gray=(299*r+587*g+114*b+500)//1000
        assert after['palette'][i]=='#'+f'{gray:02x}'*3
    count+=1
    workspace=json.loads((root/case['workspace']).read_text());assert workspace['format']=='ezpix-workspace' and workspace['version']==1
    with zipfile.ZipFile(root/case['zip']) as z:
        assert z.testzip() is None and z.namelist()[0]=='mimetype' and z.read('mimetype')==b'application/x-ezpix-workspace'
        manifest=json.loads(z.read('workspace.json'));assert manifest['activeId']==workspace['activeId']
        for i,e in enumerate(manifest['documents']):
            assert e['path']==f'documents/document-{i+1}.ezpix'
            assert z.read(e['path']).decode()==workspace['documents'][i]['project'];count+=1
    with zipfile.ZipFile(root/case['batch']) as z:
        assert z.testzip() is None;meta=json.loads(z.read('workspace-assets.json'));assert len(meta['documents'])==len(case['batchFrames'])
        assert all('..' not in p.split('/') and not p.startswith('/') for p in z.namelist())
        for i,frames in enumerate(case['batchFrames']):
            prefix=f'document-{i+1}/';assert meta['documents'][i]['directory']==prefix[:-1]
            assets=json.loads(z.read(prefix+'assets.json'));image=Image.open(io.BytesIO(z.read(prefix+'atlas.png'))).convert('RGBA')
            assert len(assets['frames'])==len(frames)
            for f,expected in zip(assets['frames'],frames):
                assert list(image.crop((f['x'],f['y'],f['x']+f['width'],f['y']+f['height'])).tobytes())==expected;count+=1
json.dump({'status':'passed','checks':count,'cases':len(data),'readers':['independent integer grayscale','Python zipfile','Pillow PNG'],'evidence':['hidden source RGB/alpha/text/palette','exact workspace projects and active identity','safe paths and CRCs','all document atlas frame pixels']},sys.stdout)
