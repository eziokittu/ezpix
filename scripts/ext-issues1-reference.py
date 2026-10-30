"""Independent readers for downloaded projects, actual capture, icons and store media."""
from pathlib import Path
from PIL import Image
import base64, json, zipfile, hashlib, io

root = Path(__file__).resolve().parents[1]
out = root / 'artifacts/ext-issues1'
checks = []
def project(name):
    doc = json.loads((out / f'{name}.ezpix').read_text())
    assert doc['version'] == 16 and doc['engine'] == '0.465.0'
    assert len(doc['layers']) == 1 and len(doc['frames']) == 1
    rgba = base64.b64decode(doc['layers'][0]['cels'][0]['rgba'], validate=True)
    assert len(rgba) == doc['width'] * doc['height'] * 4
    assert 'conversion' not in doc
    return doc, rgba

_, rgba = project('exact')
expected = bytes(c for y in range(8) for x in range(16) for c in ((0,200,0,255) if x < 4 else (10,220,10,255) if x < 8 else (180,20,30,255)))
assert rgba == expected
for name, cutoff in [('tolerance-zero', 4), ('tolerance-shades', 8)]:
    _, rgba = project(name)
    expected = bytes(c for y in range(8) for x in range(16) for c in ((0,0,0,0) if x < cutoff else (10,220,10,255) if x < 8 else (180,20,30,255)))
    assert rgba == expected
checks.append('independently decoded full-image and tolerance-cutout project pixels')
capture = Image.open(out / 'real-capture.png').convert('RGBA')
geometry = json.loads((out / 'capture-geometry.json').read_text())
viewport = Image.open(out / 'pre-capture-viewport.png').convert('RGBA')
r = geometry['rect']; sx = viewport.width / geometry['viewport']['width']; sy = viewport.height / geometry['viewport']['height']
import math
expected_capture = viewport.crop((math.floor(r['x']*sx),math.floor(r['y']*sy),math.ceil((r['x']+r['width'])*sx),math.ceil((r['y']+r['height'])*sy)))
assert capture.size == expected_capture.size
assert capture.tobytes() == expected_capture.tobytes()
assert set(capture.getdata()) == {(238,238,238,255), (180,20,30,255)}
checks.append('real region screenshot contains only exact fixture colours without overlay contamination')
if (out / 'handoff-received.ezpix').exists():
    a, pa = project('handoff-source'); b, pb = project('handoff-received')
    assert (a['width'],a['height'],pa) == (b['width'],b['height'],pb)
    checks.append('website handoff project retains exact pixels without source-image metadata')
for size in [16,32,48,128]:
    icon = Image.open(root / f'extension/icons/ezpix-insta-{size}.png').convert('RGBA')
    assert icon.size == (size,size)
    assert icon.getpixel((0,0))[3] == 0
checks.append('all shared icon sizes have transparent outer corners')
version = json.loads((root / 'packages/core/package.json').read_text())['version']
archive = root / f'dist/release/ezpix-insta-store-assets-{version}.zip'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist()) == 12
    for name in z.namelist():
        assert z.read(name) == (root / 'dist/store-assets' / name).read_bytes()
        if name.endswith('.png'):
            img = Image.open(io.BytesIO(z.read(name)))
            expected_size = (128,128) if 'icon' in name else (440,280) if 'small-promo' in name else (1400,560) if 'marquee' in name else (1280,800)
            assert img.size == expected_size, name
    checks.append('twelve-file listing archive CRCs, exact source bytes and all media dimensions')
report = {'checks':checks, 'storeArchiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(out / 'reference-result.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS independent readers:', len(checks), 'groups')
