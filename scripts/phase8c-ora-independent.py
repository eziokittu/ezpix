"""Independent synthetic-fixture ORA reader/writer (stdlib XML/ZIP plus Pillow)."""
import io
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, __version__

root = Path(sys.argv[1])
layers = []
with zipfile.ZipFile(root / 'independent-read.ora') as archive:
    assert archive.read('mimetype') == b'image/openraster'
    image = ET.fromstring(archive.read('stack.xml'))
    for layer in reversed(list(image.find('stack'))):
        with Image.open(io.BytesIO(archive.read(layer.attrib['src']))) as png:
            layers.append({'name': layer.attrib['name'], 'visible': layer.attrib.get('visibility') != 'hidden', 'opacity': float(layer.attrib.get('opacity', 1)), 'rgba': list(png.convert('RGBA').tobytes())})
    assert list(Image.open(io.BytesIO(archive.read('mergedimage.png'))).size) == [3, 2]

# Produce XML, PNGs and a ZIP with an independent implementation in each case.
image = ET.Element('image', version='0.0.3', w='3', h='2', name='Independent ORA')
stack = ET.SubElement(image, 'stack')
with zipfile.ZipFile(root / 'pillow-write.ora', 'w') as archive:
    archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
    for index, layer in reversed(list(enumerate(layers))):
        path = f'data/layer{index}.png'
        ET.SubElement(stack, 'layer', name=layer['name'], src=path, visibility='visible' if layer['visible'] else 'hidden', opacity=str(layer['opacity']), x='0', y='0')
        stream = io.BytesIO()
        Image.frombytes('RGBA', (3, 2), bytes(layer['rgba'])).save(stream, format='PNG')
        archive.writestr(path, stream.getvalue(), compress_type=zipfile.ZIP_DEFLATED)
    archive.writestr('stack.xml', ET.tostring(image, encoding='utf-8', xml_declaration=True), compress_type=zipfile.ZIP_DEFLATED)
print(json.dumps({'layers': layers, 'pillow': __version__}, ensure_ascii=True))
