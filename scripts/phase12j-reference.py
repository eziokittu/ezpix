import json,sys
from decimal import Decimal,localcontext,ROUND_FLOOR
# Independent high precision LUT arithmetic, followed by explicit byte composition.
def table(o):
 with localcontext() as context:
  context.prec=50;black=Decimal(o['inputBlack']);span=Decimal(o['inputWhite'])-black;out=Decimal(o['outputBlack']);width=Decimal(o['outputWhite'])-out;power=Decimal(1)/Decimal(str(o['gamma']));result=[]
  for i in range(256):
   x=max(Decimal(0),min(Decimal(1),(Decimal(i)-black)/span))
   y=x**power if x else Decimal(0)
   result.append(int((out+width*y+Decimal('.5')+Decimal('1e-10')).to_integral_value(rounding=ROUND_FLOOR)))
  return result
results=[]
for study in json.load(open(sys.argv[1])):
 o=study['options'];tables=[table(o)]+[table(o['channels'][k]) for k in ['red','green','blue']];pixels=study['pixels'][:]
 for i in range(0,len(pixels),4):
  if pixels[i+3]:pixels[i:i+3]=[tables[k+1][tables[0][pixels[i+k]]] for k in range(3)]
 results.append({'tables':tables,'pixels':pixels})
json.dump(results,sys.stdout)
