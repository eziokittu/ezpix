import io
import json
import struct
import sys
from pathlib import Path
from PIL import GimpPaletteFile, __version__

root = Path(sys.argv[1])
gpl = GimpPaletteFile.GimpPaletteFile(io.BytesIO((root / 'palette-gpl.gpl').read_bytes())).getpalette()[0]
result = {'pillow': __version__, 'gpl': [list(gpl[i:i+3]) for i in range(0, len(gpl), 3)]}
result['ezpalette'] = [list(bytes.fromhex(h[1:])) for h in json.loads((root / 'palette-ezpalette.ezpalette').read_text())['colors']]
result['hex'] = [list(bytes.fromhex(h.strip()[1:])) for h in (root / 'palette-hex.hex').read_text().splitlines()]
pal = (root / 'palette-jasc.pal').read_text().splitlines()
assert pal[:2] == ['JASC-PAL', '0100']
assert len(pal[3:]) == int(pal[2])
result['jasc'] = [list(map(int, row.split())) for row in pal[3:]]
riff = (root / 'palette-riff.pal').read_bytes()
assert riff[:4] == b'RIFF' and riff[8:16] == b'PAL data'
assert struct.unpack_from('<I', riff, 4)[0] == len(riff)-8
version, count = struct.unpack_from('<HH', riff, 20)
assert version == 0x300
result['riff'] = [list(struct.unpack_from('3B', riff, 24+i*4)) for i in range(count)]
act = (root / 'palette-act.act').read_bytes()
count, transparent = struct.unpack_from('>HH', act, 768)
assert transparent == 65535
result['act'] = [list(act[i:i+3]) for i in range(0, (count or 256)*3, 3)]
print(json.dumps(result))
