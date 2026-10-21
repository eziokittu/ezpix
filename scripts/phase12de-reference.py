# Independent matrix/vector implementation; no runtime source import.
import json, math, sys
M1=((.4122214708,.5363325363,.0514459929),(.2119034982,.6806995451,.1073969566),(.0883024619,.2817188376,.6299787005))
M2=((.2104542553,.7936177850,-.0040720468),(1.9779984951,-2.4285922050,.4505937099),(.0259040371,.7827717662,-.8086757660))
I1=((1,.3963377774,.2158037573),(1,-.1055613458,-.0638541728),(1,-.0894841775,-1.2914855480))
I2=((4.0767416621,-3.3077115913,.2309699292),(-1.2684380046,2.6097574011,-.3413193965),(-.0041960863,-.7034186147,1.7076147010))
def dot(matrix,vector): return [sum(a*b for a,b in zip(row,vector)) for row in matrix]
def clamp(v): return max(0,min(1,v))
def convert(rgb,o):
 if o['kind']=='palette':
  colors=[tuple(bytes.fromhex(c[1:])) for c in o['colors']]
  return min(enumerate(colors),key=lambda item:(sum((a-b)**2 for a,b in zip(item[1],rgb)),item[0]))[1]
 if all(o[k]==0 for k in ('hue','chroma','lightness')): return rgb
 linear=[v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4 for v in rgb]
 L,a,b=dot(M2,[math.cbrt(v) for v in dot(M1,linear)])
 L=clamp(L+o['lightness']/100)
 if L<=0 or L>=1: return [round(L*255)]*3
 C=math.hypot(a,b); hue=(0 if C<=.000004 else math.atan2(b,a))+o['hue']*math.pi/180
 C=max(0,min(.4,(0 if C<=.000004 else C)+o['chroma']/100))
 def raster(c): return dot(I2,[v**3 for v in dot(I1,[L,c*math.cos(hue),c*math.sin(hue)])])
 def inside(v): return all(0<=x<=1 for x in v)
 result=raster(C)
 if not inside(result):
  low,high=0,C
  for _ in range(24):
   mid=(low+high)/2
   if inside(raster(mid)): low=mid
   else: high=mid
  result=raster(low)
 result=[clamp(v) for v in result]
 return [math.floor(clamp(12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055)*255+.5+1e-10) for v in result]
studies=json.load(open(sys.argv[1]));out=[]
for study in studies:
 pixels=study['pixels'][:]
 for i in range(0,len(pixels),4):
  if pixels[i+3]: pixels[i:i+3]=convert(pixels[i:i+3],study['options'])
 out.append(pixels)
json.dump(out,sys.stdout)
