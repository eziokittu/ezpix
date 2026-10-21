/** D65 Oklab matrices published by Björn Ottosson (2021 revision):
 * https://bottosson.github.io/posts/oklab/ ; sRGB transfer and powerless
 * hue threshold follow https://www.w3.org/TR/css-color-4/ .
 * Gamut policy is EzPix's bounded chroma reduction, not CSS local-MINDE. */
export interface OklchAdjustment {kind:'oklch';hue:number;chroma:number;lightness:number}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function adjustOklch(r:number,g:number,b:number,o:OklchAdjustment):number[]{
 if(o.hue===0&&o.chroma===0&&o.lightness===0)return [r,g,b];
 const linear=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
 const R=linear(r),G=linear(g),B=linear(b);
 const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B),m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B),s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);
 const L=clamp(.2104542553*l+.7936177850*m-.0040720468*s+o.lightness/100),a=1.9779984951*l-2.4285922050*m+.4505937099*s,bb=.0259040371*l+.7827717662*m-.8086757660*s;
 if(L<=0)return [0,0,0];if(L>=1)return [255,255,255];
 const originalC=Math.hypot(a,bb),h=((originalC<=.000004?0:Math.atan2(bb,a))+o.hue*Math.PI/180),C=Math.max(0,Math.min(.4,(originalC<=.000004?0:originalC)+o.chroma/100));
 const rgb=(c:number)=>{const A=c*Math.cos(h),b=c*Math.sin(h),l=(L+.3963377774*A+.2158037573*b)**3,m=(L-.1055613458*A-.0638541728*b)**3,s=(L-.0894841775*A-1.2914855480*b)**3;return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s];};
 const inGamut=(v:number[])=>v.every(x=>x>=0&&x<=1);let result=rgb(C);
 if(!inGamut(result)){let low=0,high=C;for(let i=0;i<24;i++){const mid=(low+high)/2;if(inGamut(rgb(mid)))low=mid;else high=mid;}result=rgb(low);}
 return result.map(v=>{v=clamp(v);const encoded=v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;return Math.floor(clamp(encoded)*255+.5+1e-10);});
}
