"""Decode the actual floating-layout downloads independently of the shared core."""
from pathlib import Path
import base64, json
root = Path(__file__).resolve().parents[1]
out = root / 'artifacts/floating-studio'
def pixels(name):
    doc = json.loads((out / (name + '.ezpix')).read_text())
    assert doc['engine'] == '0.465.0' and doc['version'] == 16
    assert 'conversion' not in doc
    data = base64.b64decode(doc['layers'][0]['cels'][0]['rgba'], validate=True)
    assert len(data) == doc['width'] * doc['height'] * 4
    return doc['width'], doc['height'], data
expected = bytes(c for y in range(16) for x in range(32) for c in ((0,200,0,255) if x < 8 else (10,220,10,255) if x < 16 else (180,20,30,255)))
assert pixels('exact') == (32,16,expected)
cutout = bytes(c for y in range(16) for x in range(32) for c in ((0,0,0,0) if x < 16 else (180,20,30,255)))
assert pixels('cutout') == (32,16,cutout)
assert pixels('before-cancel') == pixels('after-cancel')
checks = ['exact original-colour pixels', 'chosen green shades removed while red pixels remain exact', 'capture cancellation preserves the previous conversion']
if (out / 'handoff-source.ezpix').exists():
    assert pixels('handoff-source') == pixels('handoff-received')
    checks.append('website handoff preserves exact dimensions and pixels without original-media metadata')
(out / 'reference-result.json').write_text(json.dumps({'checks':checks},indent=2)+'\n')
print('PASS independent floating-workspace downloads:', len(checks), 'groups')
