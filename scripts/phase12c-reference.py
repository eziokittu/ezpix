import bisect,json,sys
from fractions import Fraction
studies=json.load(open(sys.argv[1],encoding='utf-8'))
results=[]
for study in studies:
 points=study['points'];xs=[p['input'] for p in points]
 table=[]
 for channel in range(256):
  index=max(0,min(len(points)-2,bisect.bisect_right(xs,channel)-1))
  a,b=points[index:index+2]
  value=Fraction(a['output'])+Fraction(channel-a['input'],b['input']-a['input'])*(b['output']-a['output'])
  table.append((value+Fraction(1,2)).numerator//(value+Fraction(1,2)).denominator)
 pixels=study['pixels'][:]
 for i in range(0,len(pixels),4):
  if pixels[i+3]:pixels[i:i+3]=[table[v] for v in pixels[i:i+3]]
 results.append({'table':table,'pixels':pixels})
print(json.dumps(results))
