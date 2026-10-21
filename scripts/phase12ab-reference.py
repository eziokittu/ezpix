import colorsys,json,math,sys
studies=json.load(open(sys.argv[1],encoding='utf-8'))
result=[]
for study in studies:
 o=study['options'];p=study['pixels'][:]
 for i in range(0,len(p),4):
  if p[i+3]==0:continue
  rgb=p[i:i+3]
  if o['kind']=='hsl':
   if o['hue']==o['saturation']==o['lightness']==0:continue
   h,l,s=colorsys.rgb_to_hls(*(v/255 for v in rgb))
   h=(h+o['hue']/360)%1;s=max(0,min(1,s+o['saturation']/100));l=max(0,min(1,l+o['lightness']/100))
   rgb=[math.floor(v*255+0.5+1e-10) for v in colorsys.hls_to_rgb(h,l,s)]
  else:
   rgb=[math.floor(o['outputBlack']+(o['outputWhite']-o['outputBlack'])*max(0,min(1,(v-o['inputBlack'])/(o['inputWhite']-o['inputBlack'])))**(1/o['gamma'])+0.5+1e-10) for v in rgb]
  p[i:i+3]=rgb
 result.append(p)
print(json.dumps(result))
