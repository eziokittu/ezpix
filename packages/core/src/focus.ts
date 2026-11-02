import {validateRaster,convert,extractPalette,type Raster,type Recipe} from './conversion.js';
import {createDocument,makeLayer,checkCelBudget,type PixelDocument} from './document.js';
import {nearestPalettePixel,orderedPaletteOffset} from './palette-map.js';
export interface FocusRect{x:number;y:number;width:number;height:number}
export interface FocusAdjustments{brightness:number;contrast:number;exposure:number;saturation:number;vibrance:number;temperature:number;tint:number;hue:number;gamma:number;shadows:number;highlights:number;sharpness:number;blur:number;filter:'original'|'mono'|'sepia'|'invert';flipX:boolean;flipY:boolean}
export const defaultFocusAdjustments=():FocusAdjustments=>({brightness:0,contrast:0,exposure:0,saturation:0,vibrance:0,temperature:0,tint:0,hue:0,gamma:1,shadows:0,highlights:0,sharpness:0,blur:0,filter:'original',flipX:false,flipY:false});
export interface FocusOptions{rect:FocusRect;method:'background'|'polygon'|'crop'|'chroma';tolerance:number;polygon?:{x:number;y:number}[];shape?:'rectangle'|'ellipse'|'polygon';keyColor?:number[];softness?:number;mask?:Uint8Array;adjustments?:Partial<FocusAdjustments>}
function rect(r:FocusRect,s:Raster){if(!r||![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>s.width||r.y+r.height>s.height)throw new Error('Select an object inside the image.');}
function settings(input:Partial<FocusAdjustments>={}):FocusAdjustments{const a={...defaultFocusAdjustments(),...input};for(const k of ['brightness','contrast','saturation','vibrance','temperature','tint','shadows','highlights'] as const)if(!Number.isFinite(a[k])||Math.abs(a[k])>100)throw new Error('Invalid photo adjustment.');if(!Number.isFinite(a.exposure)||Math.abs(a.exposure)>3||!Number.isFinite(a.gamma)||a.gamma<.25||a.gamma>4||!Number.isFinite(a.hue)||Math.abs(a.hue)>180||!Number.isFinite(a.sharpness)||a.sharpness<0||a.sharpness>100||!Number.isInteger(a.blur)||a.blur<0||a.blur>2||!['original','mono','sepia','invert'].includes(a.filter)||typeof a.flipX!=='boolean'||typeof a.flipY!=='boolean')throw new Error('Invalid photo adjustment.');return a;}
/** Non-destructive local cutout and tone controls. No semantic segmentation. */
export function focusRaster(source:Raster,options:FocusOptions):Raster{
 validateRaster(source);rect(options.rect,source);const shape=options.shape??(options.method==='polygon'?'polygon':'rectangle'),a=settings(options.adjustments);
 if(!['background','polygon','crop','chroma'].includes(options.method)||!['rectangle','ellipse','polygon'].includes(shape)||!Number.isInteger(options.tolerance)||options.tolerance<0||options.tolerance>255||options.softness!==undefined&&(!Number.isInteger(options.softness)||options.softness<0||options.softness>128))throw new Error('Invalid focus settings.');
 if(options.method==='chroma'&&(!Array.isArray(options.keyColor)||options.keyColor.length!==3||options.keyColor.some(n=>!Number.isInteger(n)||n<0||n>255)))throw new Error('Choose a background colour to remove.');
 const points=options.polygon;if(shape==='polygon'&&(!Array.isArray(points)||points.length<3||points.length>128||points.some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=source.width||p.y>=source.height)))throw new Error('Outline the object with 3-128 points.');
 const r=options.rect,w=r.width,h=r.height,pixels=new Uint8ClampedArray(w*h*4);
  if(options.mask!==undefined&&(!(options.mask instanceof Uint8Array)||options.mask.length!==w*h||options.mask.some(n=>n>1)))throw new Error('Invalid focus selection mask.');
 for(let y=0;y<h;y++)pixels.set(source.pixels.subarray(((y+r.y)*source.width+r.x)*4,((y+r.y)*source.width+r.x+w)*4),y*w*4);
 if(options.method==='background'){
  const samples=[0,w-1,(h-1)*w,w*h-1].map(i=>[...pixels.subarray(i*4,i*4+3)]),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=0,end=0;
  const add=(i:number)=>{if(seen[i])return;seen[i]=1;const p=i*4;if(pixels[p+3]&&!samples.some(s=>Math.max(...s.map((c,k)=>Math.abs(pixels[p+k]-c)))<=options.tolerance))return;queue[end++]=i;};
  for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
  while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);pixels.fill(0,i*4,i*4+4);if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
 }
 const tone=Object.entries(a).some(([key,value])=>!['flipX','flipY','blur','sharpness'].includes(key)&&value!==(defaultFocusAdjustments() as unknown as Record<string,unknown>)[key]);
 const clamp=(n:number)=>Math.max(0,Math.min(255,Math.round(n))),angle=a.hue*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;let inside=true;if(shape==='ellipse')inside=((x+.5-w/2)/(w/2))**2+((y+.5-h/2)/(h/2))**2<=1;
  if(shape==='polygon'){inside=false;const px=x+r.x+.5,py=y+r.y+.5;for(let k=0,j=points!.length-1;k<points!.length;j=k++){const p=points![k],q=points![j];if((p.y>py)!==(q.y>py)&&px<(q.x-p.x)*(py-p.y)/(q.y-p.y)+p.x)inside=!inside;}}
  if(options.mask&&!options.mask[y*w+x])inside=false;
   if(!inside){pixels.fill(0,i,i+4);continue;}
  if(options.method==='chroma'){const diff=Math.max(...options.keyColor!.map((c,k)=>Math.abs(pixels[i+k]-c))),soft=options.softness??0;if(diff<=options.tolerance){pixels.fill(0,i,i+4);continue;}if(soft)pixels[i+3]=clamp(pixels[i+3]*Math.min(1,(diff-options.tolerance)/soft));}
  if(!pixels[i+3]){pixels.fill(0,i,i+4);continue;}
  if(!tone)continue;
  let rgb=[...pixels.subarray(i,i+3)],luma=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
  rgb=rgb.map((v,k)=>{v*=2**a.exposure;v+=(a.brightness+a.shadows*(1-luma)**2+a.highlights*luma*luma)*2.55;v+=(k===0?a.temperature:k===2?-a.temperature:0)*.5+(k===1?-a.tint:a.tint*.5)*.4;v=(v-127.5)*(1+a.contrast/100)+127.5;return 255*(Math.max(0,Math.min(255,v))/255)**(1/a.gamma);});
  const grey=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,sat=1+a.saturation/100+a.vibrance/100*(1-(Math.max(...rgb)-Math.min(...rgb))/255);rgb=rgb.map(v=>grey+(v-grey)*sat);
  if(a.hue){const [red,green,blue]=rgb;rgb=[(.299+.701*co+.168*si)*red+(.587-.587*co+.330*si)*green+(.114-.114*co-.497*si)*blue,(.299-.299*co-.328*si)*red+(.587+.413*co+.035*si)*green+(.114-.114*co+.292*si)*blue,(.299-.299*co+1.250*si)*red+(.587-.587*co-1.050*si)*green+(.114+.886*co-.203*si)*blue];}
  if(a.filter==='mono')rgb=[grey,grey,grey];if(a.filter==='invert')rgb=rgb.map(v=>255-v);if(a.filter==='sepia'){const [red,green,blue]=rgb;rgb=[red*.393+green*.769+blue*.189,red*.349+green*.686+blue*.168,red*.272+green*.534+blue*.131];}pixels.set(rgb.map(clamp),i);
 }
 if(a.blur||a.sharpness){const before=pixels.slice(),radius=a.blur||1;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(!pixels[i+3])continue;const sum=[0,0,0];let weight=0;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const px=x+dx,py=y+dy;if(px<0||py<0||px>=w||py>=h)continue;const j=(py*w+px)*4;if(!before[j+3])continue;weight++;for(let k=0;k<3;k++)sum[k]+=before[j+k];}for(let k=0;k<3;k++)pixels[i+k]=clamp(a.blur?sum[k]/weight:before[i+k]+(before[i+k]-sum[k]/weight)*a.sharpness/50);}}
 if(a.flipX||a.flipY){const before=pixels.slice();for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((a.flipY?h-1-y:y)*w+(a.flipX?w-1-x:x))*4;pixels.set(before.subarray(i,i+4),(y*w+x)*4);}}
 return {width:w,height:h,pixels};
}
/** Bounded colour-template tracking; no semantic/object/occlusion inference. */
export function trackFocus(previous:Raster,next:Raster,box:FocusRect,radius=24):FocusRect{
 validateRaster(previous);validateRaster(next);rect(box,previous);if(previous.width!==next.width||previous.height!==next.height||!Number.isInteger(radius)||radius<0||radius>32)throw new Error('Tracking requires matching frames and radius 0-32.');
 const step=Math.max(1,Math.ceil(Math.max(box.width,box.height)/12));let best=Infinity,bx=box.x,by=box.y;
 for(let dy=-radius;dy<=radius;dy+=2)for(let dx=-radius;dx<=radius;dx+=2){const x=box.x+dx,y=box.y+dy;if(x<0||y<0||x+box.width>next.width||y+box.height>next.height)continue;let error=0;
  for(let sy=0;sy<box.height;sy+=step)for(let sx=0;sx<box.width;sx+=step){const a=((box.y+sy)*previous.width+box.x+sx)*4,b=((y+sy)*next.width+x+sx)*4;for(let k=0;k<3;k++)error+=Math.abs(previous.pixels[a+k]-next.pixels[b+k]);}
  error+=.001*(dx*dx+dy*dy);if(error<best){best=error;bx=x;by=y;}
 }
 return {...box,x:bx,y:by};
}
export function focusAnimation(frames:Raster[],options:FocusOptions,recipe:Recipe,fps=4,track=true):PixelDocument{
 if(!Array.isArray(frames)||!frames.length||frames.length>32||!Number.isInteger(fps)||fps<1||fps>4||frames.length>fps*8||typeof track!=='boolean')throw new Error('Use 1-32 frames at 1-4 FPS (maximum 8 seconds).');
 if(frames.reduce((n,f)=>n+f.width*f.height,0)>8*1024*1024)throw new Error('Focus frames exceed 8 megapixels combined.');
 let box={...options.rect};const crops:Raster[]=[];for(const [i,frame] of frames.entries()){if(i&&track)box=trackFocus(frames[i-1],frame,box);const dx=box.x-options.rect.x,dy=box.y-options.rect.y;crops.push(focusRaster(frame,{...options,rect:box,polygon:options.polygon?.map(p=>({x:p.x+dx,y:p.y+dy}))}));}
 checkCelBudget(recipe.width,recipe.height,1,frames.length);
 const first=crops[0],r={...recipe,crop:{x:0,y:0,width:first.width,height:first.height}},docs=crops.map(s=>convert(s,{...r,palette:r.palette==='adaptive'?'original':r.palette})),doc=createDocument(r.width,r.height,'Focused asset');
 doc.palette=[...docs[0].palette];
 if(r.palette==='adaptive'){
  const samples=new Uint8ClampedArray(crops.length*1024*4);crops.forEach((s,f)=>{for(let i=0;i<1024;i++){const at=Math.min(s.width*s.height-1,Math.floor(i*s.width*s.height/1024));samples.set(s.pixels.subarray(at*4,at*4+4),(f*1024+i)*4);}});const palette=extractPalette(samples,r.colors);doc.palette=palette.map(p=>'#'+p.map(n=>n.toString(16).padStart(2,'0')).join(''));
  for(const d of docs)for(let i=0;i<d.cel.pixels.length;i+=4)if(d.cel.pixels[i+3])d.cel.pixels.set(nearestPalettePixel([...d.cel.pixels.subarray(i,i+3)],palette,r.dither?orderedPaletteOffset(i/4%r.width,Math.floor(i/4/r.width),100):0),i);
 }
 doc.frames=docs.map((_,i)=>({id:`frame-${i+1}`,duration:Math.round(1000/fps)}));doc.layers=[makeLayer(doc,'layer-1','Focused object',true,Object.fromEntries(docs.map((d,i)=>[doc.frames[i].id,d.cel.pixels.slice()])))];if(frames.length>1)doc.tags=[{id:'tag-1',name:'Captured motion',from:0,to:frames.length-1,mode:'loop'}];return doc;
}
