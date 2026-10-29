"""Independent validation of the current production upload-candidate ZIP."""
from pathlib import Path
from PIL import Image
import json, zipfile, hashlib, io
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'packages/core/package.json').read_text())['version']
path=root/'dist/release'/f'ezpix-snapforge-{version}.zip'
expected={'manifest.json','app.html','app.js','app.css','background.js','converter.css','handoff.html','popup.html','popup.js','privacy.html','pixel-studio.css','worker.js'}|{f'icons/snapforge-{n}.png' for n in [16,32,48,128]}
with zipfile.ZipFile(path) as z:
    assert set(z.namelist())==expected and len(z.namelist())==len(expected)
    assert z.testzip() is None
    for name in z.namelist():assert z.read(name)==(root/'dist/extension'/name).read_bytes(),name
    manifest=json.loads(z.read('manifest.json'))
    assert manifest['version']==version and manifest['manifest_version']==3
    assert manifest['permissions']==['activeTab','scripting','alarms']
    assert manifest['externally_connectable']['matches']==['https://glitchbong.com/*']
    assert manifest['minimum_chrome_version']=='120' and 'host_permissions' not in manifest
    for n in [16,32,48,128]:assert Image.open(io.BytesIO(z.read(f'icons/snapforge-{n}.png'))).size==(n,n)
report={'version':version,'archiveFiles':len(expected),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'status':'passed'}
(root/'artifacts/phase481-500').mkdir(parents=True,exist_ok=True)
(root/'artifacts/phase481-500/release-result.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS independent release ZIP',json.dumps(report))
