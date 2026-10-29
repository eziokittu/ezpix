"""Build editable starter layer rasters from downloaded Kenney CC0 tiles.
Run after downloading the exact archives recorded in starter-sources.json.
Pillow is an offline asset-authoring dependency, never a runtime dependency.
"""
from pathlib import Path
from PIL import Image
import json, hashlib, shutil

root = Path(__file__).resolve().parents[1]
sources = root / 'artifacts/issues4/sources'
out = root / 'artifacts/issues4/starters'
public = root.parent / 'glitchbong/public/ezpix/starters'
out.mkdir(parents=True, exist_ok=True)
(public / 'licenses').mkdir(exist_ok=True)
archive_urls = {'tiny-dungeon': 'https://kenney.nl/media/pages/assets/tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip', 'tiny-town': 'https://kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip', 'micro-roguelike': 'https://kenney.nl/media/pages/assets/micro-roguelike/bbcaf50993-1677578239/kenney_micro-roguelike.zip'}
records = []
for pack in ['tiny-dungeon', 'tiny-town', 'micro-roguelike']:
    shutil.copyfile(sources/pack/'License.txt', public/'licenses'/f'{pack}.txt')
    records.append({'pack': pack, 'author': 'Kenney', 'source': 'https://kenney.nl/assets/'+pack,
                    'license': 'CC0-1.0', 'archiveUrl': archive_urls[pack], 'archiveSha256': hashlib.sha256((sources/pack/'source.zip').read_bytes()).hexdigest()})
(public/'starter-sources.json').write_text(json.dumps(records, indent=2)+'\n')

def tile(pack, index):
    sub = 'Tiles/Colored' if pack == 'micro-roguelike' else 'Tiles'
    return Image.open(sources/pack/sub/f'tile_{index:04}.png').convert('RGBA')

def save(id, name, pack, category, layers):
    rendered = Image.new('RGBA', layers[0][1].size)
    for _, im in layers:
        rendered.alpha_composite(im)
    rendered.save(public/f'{id}.png')
    data = {'id':id, 'name':name, 'category':category, 'description':f'Kenney / {pack.replace("-", " ").title()} · CC0. Editable artwork layers.',
            'width':rendered.width,'height':rendered.height, 'layers':[{'name':n,'pixels':list(im.tobytes())} for n,im in layers]}
    (out/f'{id}.json').write_text(json.dumps(data))

def scene(pack, id, name, floor, wall, objects):
    base=Image.new('RGBA',(128,96))
    for y in range(6):
        for x in range(8):
            base.alpha_composite(tile(pack, wall if y==0 else floor), (x*16,y*16))
    props=Image.new('RGBA',base.size)
    for index,x,y in objects:
        props.alpha_composite(tile(pack,index),(x*16,y*16))
    save(id,name,pack,'Scenes',[('Environment',base),('Props and characters',props)])

# Creator-authored sample compositions, integer reduction to their native pixels.
# Exclude the promotional footer; retain the original notice separately.
for pack,id,name in [('tiny-dungeon','kenney-dungeon','Dungeon chamber'),('tiny-town','kenney-town','Village garden')]:
    sample=Image.open(sources/pack/'Sample.png').convert('RGBA').crop((0,0,768,432)).resize((256,144),Image.Resampling.NEAREST)
    save(id,name,pack,'Scenes',[('Kenney sample artwork',sample),('Drawing',Image.new('RGBA',sample.size))])

def study(pack,id,name,indices,category):
    size=8 if pack=='micro-roguelike' else 16
    cols=8; rows=(len(indices)+cols-1)//cols
    im=Image.new('RGBA',(cols*(size+8)+8, rows*(size+8)+8))
    for i,index in enumerate(indices):
        im.alpha_composite(tile(pack,index),(8+i%cols*(size+8),8+i//cols*(size+8)))
    save(id,name,pack,category,[('Sprites',im)])

study('tiny-dungeon','kenney-characters','Dungeon characters',list(range(84,89))+list(range(96,100))+list(range(108,114))+[121],'Characters')
study('tiny-dungeon','kenney-equipment','Equipment and potions',list(range(100,108))+list(range(114,121))+list(range(124,130)),'Items')
study('tiny-town','kenney-architecture','Town architecture',list(range(44,57))+list(range(80,96))+[102,103,104],'Environment')
study('micro-roguelike','kenney-micro','Micro world tiles',list(range(0,18))+list(range(80,96))+list(range(130,144)),'Tiles')
print('Prepared six CC0 layered starters and three original licence notices.')
