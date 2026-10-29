"""Independent project/PNG and release-ZIP verification with stdlib + Pillow."""
from pathlib import Path
from PIL import Image
import base64, json, hashlib, zipfile
root=Path(__file__).resolve().parents[1]
web=root.parent/'glitchbong'
catalog=json.loads((web/'src/app/tools/ezpix/editor/starter-catalog.json').read_text())
pixels=0
for item in catalog:
    raw=(web/'public/ezpix/starters'/f'{item["id"]}.ezpix').read_bytes()
    assert len(raw)==item['bytes']
    assert hashlib.sha256(raw).hexdigest()==item['sha256']
    doc=json.loads(raw)
    assert (doc['width'],doc['height'],len(doc['layers']),len(doc['frames']))==(item['width'],item['height'],item['layers'],item['frames'])
    if not item['id'].startswith('kenney-'): continue
    result=Image.new('RGBA',(doc['width'],doc['height']))
    for layer in doc['layers']:
        assert layer['visible'] and layer['opacity']==255 and layer['blendMode']=='normal'
        cel=layer['cels'][0]
        plane=bytes(doc['width']*doc['height']*4) if cel.get('empty') else base64.b64decode(cel['rgba'])
        assert len(plane)==doc['width']*doc['height']*4
        result=Image.alpha_composite(result,Image.frombytes('RGBA',result.size,plane))
    png=Image.open(web/'public/ezpix/starters'/f'{item["id"]}.png').convert('RGBA')
    assert result.tobytes()==png.tobytes(),item['id']
    pixels+=doc['width']*doc['height']
archive=root/'dist/release/ezpix-snapforge-0.459.0.zip'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'manifest.json' in z.namelist() and len(z.namelist())==15
    for name in z.namelist(): assert z.read(name)==(root/'dist/extension'/name).read_bytes()
    manifest=json.loads(z.read('manifest.json'))
    assert manifest['version']=='0.459.0'
    assert manifest['externally_connectable']['matches']==['https://glitchbong.com/*']
    assert manifest['permissions']==['activeTab','scripting','alarms']
report={'starters':len(catalog),'cc0Projects':6,'pngPixels':pixels,'archiveFiles':15,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(root/'artifacts/issues4/independent-result.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS',json.dumps(report))
