import {validateRaster,type Raster} from './conversion.js';
export const PHOTO_EFFECTS=[
 ['soft-glow','Soft glow','Light'],['bloom','Bloom','Light'],['matte','Matte','Light'],['fade','Faded print','Light'],['warm-glow','Golden light','Light'],['cool-mist','Cool mist','Light'],['light-leak','Amber leak','Light'],['rainbow-leak','Prism leak','Light'],
 ['sepia','Sepia','Colour'],['cyanotype','Cyanotype','Colour'],['cross-process','Cross process','Colour'],['solarize','Solarise','Colour'],['invert','Negative','Colour'],['noir','Deep noir','Colour'],['duotone-teal','Teal duotone','Colour'],['duotone-rose','Rose duotone','Colour'],
 ['halftone','Halftone dots','Texture'],['scanlines','Scanlines','Texture'],['vhs','VHS noise','Texture'],['paper','Paper texture','Texture'],['glitter','Glitter','Texture'],['shimmer','Shimmer','Texture'],
 ['rgb-split','RGB split','Lens'],['lens-blur','Soft focus','Lens'],['tilt-shift','Tilt shift','Lens'],['radial-blur','Radial blur','Lens'],['motion-blur','Motion blur','Lens'],['frosted-glass','Frosted glass','Lens'],
 ['threshold','Ink threshold','Graphic'],['comic','Comic print','Graphic'],['emboss','Emboss','Graphic'],['edge-glow','Neon edges','Graphic'],['oil-paint','Painterly','Graphic'],['posterize','Posterise','Graphic'],['grain','Film grain','Texture'],['vignette','Vignette','Light'],['duotone','Peach duotone','Colour'],
] as const;
export type PhotoEffect=typeof PHOTO_EFFECTS[number][0];
/** Original deterministic effect recipes. No external presets or inference. */
export function applyPhotoEffect(source:Raster,effect:string,amount:number):Raster{
 validateRaster(source);if(!PHOTO_EFFECTS.some(e=>e[0]===effect)||!Number.isFinite(amount)||amount<0||amount>1)throw Error('Invalid photo effect.');
 const {width:w,height:h,pixels:input}=source,pixels=input.slice(),clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const sample=(x:number,y:number,c:number)=>input[(clamp(Math.round(y),0,h-1)*w+clamp(Math.round(x),0,w-1))*4+c];
 const radius=Math.max(1,Math.round(Math.min(w,h)*.018)),noise=(x:number,y:number)=>((Math.imul(x+7,374761393)^Math.imul(y+11,668265263))>>>0)%256/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!input[i+3])continue;const rgb=[input[i],input[i+1],input[i+2]],l=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,n=noise(x,y),nx=x/Math.max(1,w-1),ny=y/Math.max(1,h-1),distance=Math.hypot(nx-.5,ny-.5)*Math.SQRT2;
  const smooth=(c:number)=>(rgb[c]*2+sample(x-radius,y,c)+sample(x+radius,y,c)+sample(x,y-radius,c)+sample(x,y+radius,c))/6;
  for(let c=0;c<3;c++){
   let v=rgb[c];
   if(effect==='soft-glow')v=255-(255-v)*(255-smooth(c)*.65)/255;
   else if(effect==='bloom')v+=Math.max(0,smooth(c)-150)*1.2;
   else if(effect==='matte')v=35+v*.78;
   else if(effect==='fade')v=v*.65+l*.2+30;
   else if(effect==='warm-glow')v=v*[1.12,1.02,.85][c]+[12,5,-4][c];
   else if(effect==='cool-mist')v=v*[.82,1.04,1.13][c]+[10,14,18][c];
   else if(effect==='light-leak')v+=Math.max(0,1-Math.hypot(nx-.1,ny-.3)*1.4)*[160,62,10][c];
   else if(effect==='rainbow-leak')v+=Math.sin(nx*7+ny*4+c*2)*60*Math.max(0,1-distance*.7);
   else if(effect==='sepia')v=l*[1.15,1,.76][c]+[15,6,0][c];
   else if(effect==='cyanotype')v=[8,35,72][c]+l*[.45,.8,.72][c];
   else if(effect==='cross-process')v=c===0?Math.pow(v/255,.8)*255:c===1?clamp((v-20)*1.15,0,255):25+v*.78;
   else if(effect==='solarize')v=v>128?255-v:v;
   else if(effect==='invert')v=255-v;
   else if(effect==='noir')v=clamp((l-45)*1.55,0,255);
   else if(effect.startsWith('duotone')){const dark=effect==='duotone-teal'?[5,35,45]:effect==='duotone-rose'?[65,10,45]:[38,24,64],light=effect==='duotone-teal'?[175,245,200]:effect==='duotone-rose'?[255,210,185]:[255,214,176];v=dark[c]+(light[c]-dark[c])*l/255;}
   else if(effect==='halftone'){const size=Math.max(4,Math.round(Math.min(w,h)/60)),r=Math.hypot((x%size)/size-.5,(y%size)/size-.5);v=r<Math.sqrt(1-l/255)*.65?15:245;}
   else if(effect==='scanlines')v*=y%4<2?.6:1;
   else if(effect==='vhs')v=sample(x+Math.sin(y*.21)*radius*.5,y,c)+(n-.5)*65+(y%3===0?-25:0);
   else if(effect==='paper')v=v*.88+18+(n-.5)*24;
   else if(effect==='glitter')v+=n>.982?180:0;
   else if(effect==='shimmer')v+=Math.pow(Math.max(0,Math.sin((nx+ny)*80)),14)*70;
   else if(effect==='rgb-split')v=sample(x+(c-1)*radius,y,c);
   else if(effect==='lens-blur')v=smooth(c);
   else if(effect==='tilt-shift'){const weight=clamp(Math.abs(ny-.5)*3-.35,0,1);v=v*(1-weight)+smooth(c)*weight;}
   else if(effect==='radial-blur')v=(v+sample(x+(nx-.5)*radius*3,y+(ny-.5)*radius*3,c)+sample(x-(nx-.5)*radius*3,y-(ny-.5)*radius*3,c))/3;
   else if(effect==='motion-blur')v=(sample(x-radius*2,y,c)+sample(x-radius,y,c)+v+sample(x+radius,y,c)+sample(x+radius*2,y,c))/5;
   else if(effect==='frosted-glass')v=sample(x+(n-.5)*radius*3,y+(noise(y,x)-.5)*radius*3,c);
   else if(effect==='threshold')v=l<128?0:255;
   else if(effect==='comic'){const edge=Math.abs(sample(x-1,y,c)-sample(x+1,y,c))+Math.abs(sample(x,y-1,c)-sample(x,y+1,c));v=edge>70?15:Math.round(v/64)*64;}
   else if(effect==='emboss')v=128+sample(x+1,y+1,c)-sample(x-1,y-1,c);
   else if(effect==='edge-glow')v=Math.abs(sample(x-1,y,c)-sample(x+1,y,c))*2+Math.abs(sample(x,y-1,c)-sample(x,y+1,c))*2;
   else if(effect==='oil-paint')v=Math.round(smooth(c)/32)*32;
   else if(effect==='posterize')v=Math.round(v/51)*51;
   else if(effect==='grain')v+=(n-.5)*100;
   else if(effect==='vignette')v*=1-Math.min(1,distance*distance);
   pixels[i+c]=rgb[c]*(1-amount)+clamp(v,0,255)*amount;
  }
 }return {width:w,height:h,pixels};
}
