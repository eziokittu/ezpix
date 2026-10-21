"""Independent rational source-over reference for synthetic v6 group fixtures."""
import base64
import json
import sys
from fractions import Fraction as F

documents = json.load(open(sys.argv[1], encoding='utf-8'))
results = []
for doc in documents:
    groups = {g['id']: g for g in doc['groups']}
    layers = {l['id']: l for l in doc['layers']}
    indexes = {l['id']: i for i, l in enumerate(doc['layers'])}
    def inside(layer, group):
        parent = layer['groupId']
        while parent is not None:
            if parent == group:
                return True
            parent = groups[parent]['parentId']
        return False
    def children(parent):
        items = [(l, False, indexes[l['id']]) for l in layers.values() if l['groupId'] == parent]
        for g in groups.values():
            if g['parentId'] == parent:
                items.append((g, True, min(indexes[l['id']] for l in layers.values() if inside(l, g['id']))))
        return sorted(items, key=lambda item: item[2])
    frames = []
    for frame in doc['frames']:
        pixels = {}
        for layer in layers.values():
            decoded = {}
            for cel in layer['cels']:
                decoded[cel['frameId']] = decoded[cel['link']] if 'link' in cel else bytes(doc['width']*doc['height']*4) if cel.get('empty') else base64.b64decode(cel['rgba'])
            pixels[layer['id']] = decoded[frame['id']]
        def render(parent, position):
            result = [F(0)] * 4
            for item, group, _ in children(parent):
                if not item['visible']:
                    continue
                opacity = F(item['opacity'], 255)
                if group:
                    source = [v * opacity for v in render(item['id'], position)]
                else:
                    rgba = pixels[item['id']][position:position+4]
                    alpha = F(rgba[3], 255) * opacity
                    source = [rgba[i] * alpha for i in range(3)] + [alpha]
                result = [source[i] + result[i] * (1-source[3]) for i in range(4)]
            return result
        def rounded(v):
            return (v.numerator * 2 + v.denominator) // (2*v.denominator)
        output = []
        for p in range(0, doc['width']*doc['height']*4, 4):
            result = render(None, p)
            output += [rounded(c/result[3]) for c in result[:3]] + [rounded(result[3]*255)] if result[3] else [0, 0, 0, 0]
        frames.append(output)
    results.append(frames)
print(json.dumps(results))
