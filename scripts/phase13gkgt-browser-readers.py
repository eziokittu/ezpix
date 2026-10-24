import base64, json
from datetime import datetime, timezone
from pathlib import Path
p=Path('artifacts/phase13gkgt-ui'); source=Path('artifacts/phase13gkgt-independent'); run=json.loads((p/'result.json').read_text()); cases=json.loads((source/'cases.json').read_text())['cases']; checks=0
original=cases[0]['before']; stroke=json.loads((source/cases[0]['json']).read_text()); transform=json.loads((source/next(c['json'] for c in cases if c['operation']['action']=='transform' and c['operation']['transform']=='offset' and c['operation']['wrap'])).read_text()); cleanup=json.loads((source/next(c['json'] for c in cases if c['operation']['action']=='prune-slots')).read_text()); imported={**original,'indices':base64.b64encode(bytes([3])+base64.b64decode(original['indices'])[1:]).decode()}
for width in run['widths']:
 for name,expected in [('stroke',stroke),('transform',transform),('cleanup',cleanup),('png-import',imported),('cancel',original),('pointer-cancel',original),('noop',original)]:
  doc=json.loads((p/f'{name}-{width}.ezpix').read_text()); assert doc['version']==16 and doc['engine']==run['version']; checks+=1
  assert doc['indexed']=={'palette':expected['palette'],'transparentIndex':expected['transparentIndex']}; checks+=1
  layer=doc['layers'][0]; assert base64.b64decode(layer['cels'][0]['indices'])==base64.b64decode(expected['indices']); assert layer['cels'][1]['link']=='frame-1'; assert all('rgba' not in c for c in layer['cels']); checks+=1
result={'status':'passed','version':run['version'],'buildId':run['buildId'],'checks':checks,'files':len(run['widths'])*7,'reader':'Python base64 and JSON; oracle fixtures already independently validated','completedAt':datetime.now(timezone.utc).isoformat()}; (p/'readers.json').write_text(json.dumps(result,indent=2)); print('PASS actual indexed canvas downloads',json.dumps(result))
