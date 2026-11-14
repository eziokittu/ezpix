import {validateRaster,type Raster} from './conversion.js';
export interface DevelopEdit {kind:'develop';mode:'levels'|'curves'|'auto';black:number;white:number;gamma:number;shadows:number;midtones:number;highlights:number;strength:number}
export interface CloneEdit {kind:'clone';sourceX:number;sourceY:number;x:number;y:number;radius:number;softness:number;shape?:'circle'|'rectangle'|'ellipse'|'diamond'|'hexagon';aspect?:number;angle?:number;flipX?:boolean;sourceRadius?:number;sourceAspect?:number;sourceAngle?:number;sourceShape?:'circle'|'rectangle'|'ellipse'|'diamond'|'hexagon';sourceMask?:Uint8Array;targetMask?:Uint8Array}
const bounded=(n:number,min:number,max:number)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error('Editing value is out of bounds.');return n;};
export function luminanceHistogram(source:Raster){validateRaster(source);const bins=new Uint32Array(256);let count=0;for(let i=0;i<source.pixels.length;i+=4)if(source.pixels[i+3]){bins[Math.round(source.pixels[i]*.2126+source.pixels[i+1]*.7152+source.pixels[i+2]*.0722)]++;count++;}return {bins,count};}
/** Bounded, deterministic tone tools. Linear-light/RAW processing is not implied. */
export function developPhoto(source:Raster,edit:DevelopEdit):Raster {
 validateRaster(source);if(!['levels','curves','auto'].includes(edit.mode))throw Error('Choose a tone tool.');
 bounded(edit.black,0,254);bounded(edit.white,1,255);bounded(edit.gamma,.25,4);for(const n of [edit.shadows,edit.midtones,edit.highlights])bounded(n,-.24,.24);bounded(edit.strength,0,1);
 let black=edit.black,white=edit.white;
 if(edit.mode==='auto'){
  const {bins,count}=luminanceHistogram(source);if(count){let seen=0;black=0;white=255;for(let i=0;i<256;i++){seen+=bins[i];if(seen>=Math.max(1,count*.01)){black=i;break;}}seen=0;for(let i=255;i>=0;i--){seen+=bins[i];if(seen>=Math.max(1,count*.01)){white=i;break;}}if(white-black<8){black=0;white=255;}}
 }
 if(black>=white)throw Error('Black point must be lower than white point.');
 const anchors=[0,.25+edit.shadows,.5+edit.midtones,.75+edit.highlights,1];
 if(edit.mode==='curves'&&anchors.some((value,i)=>i>0&&value<anchors[i-1]))throw Error('Keep the tone curve rising from shadows to highlights.');
 const lut=Uint8ClampedArray.from({length:256},(_,i)=>{
  let value=i/255;
  if(edit.mode==='curves'){const point=Math.min(3,Math.floor(value*4)),mix=value*4-point;value=anchors[point]*(1-mix)+anchors[point+1]*mix;}
  else value=Math.max(0,Math.min(1,(i-black)/(white-black)))**(1/edit.gamma);
  return i*(1-edit.strength)+value*255*edit.strength;
 });
 const pixels=source.pixels.slice();for(let i=0;i<pixels.length;i+=4)if(pixels[i+3])for(let c=0;c<3;c++)pixels[i+c]=lut[pixels[i+c]];
 return {width:source.width,height:source.height,pixels};
}
/** One sampled circular patch; edge softness is alpha-correct and the source is immutable. */
export function clonePhoto(source:Raster,edit:CloneEdit):Raster {
 validateRaster(source);for(const n of [edit.sourceX,edit.sourceY,edit.x,edit.y])bounded(n,0,1);bounded(edit.radius,.002,.5);bounded(edit.softness,0,1);
 if(edit.shape&&!['circle','rectangle','ellipse','diamond','hexagon'].includes(edit.shape))throw Error('Choose a repair shape.');const aspect=bounded(edit.aspect??1,.25,4),angle=bounded(edit.angle??0,-180,180)*Math.PI/180;
 const sourceRadius=bounded(edit.sourceRadius??edit.radius,.002,.5),sourceAspect=bounded(edit.sourceAspect??edit.aspect??1,.25,4),sourceAngle=bounded(edit.sourceAngle??edit.angle??0,-180,180)*Math.PI/180;
 for(const mask of [edit.sourceMask,edit.targetMask])if(mask&&(!(mask instanceof Uint8Array)||mask.length!==source.width*source.height||mask.some(n=>n>1)))throw Error('The repair region belongs to a different image.');
 if(edit.sourceShape&&!['circle','rectangle','ellipse','diamond','hexagon'].includes(edit.sourceShape))throw Error('Choose a sample shape.');
 const {width,height}=source,pixels=source.pixels.slice(),sx=Math.round(edit.sourceX*(width-1)),sy=Math.round(edit.sourceY*(height-1)),cx=Math.round(edit.x*(width-1)),cy=Math.round(edit.y*(height-1)),radius=Math.max(1,Math.round(edit.radius*Math.min(width,height))),rx=radius*aspect,extent=Math.ceil(Math.hypot(rx,radius));
 for(let dy=-extent;dy<=extent;dy++)for(let dx=-extent;dx<=extent;dx++){
  const ux=(dx*Math.cos(angle)+dy*Math.sin(angle))/rx,uy=(-dx*Math.sin(angle)+dy*Math.cos(angle))/radius,ax=Math.abs(ux),ay=Math.abs(uy),distance=edit.shape==='rectangle'?Math.max(ax,ay):edit.shape==='diamond'?ax+ay:edit.shape==='hexagon'?Math.max(ax,ay,ax*.866+ay*.5):Math.hypot(ux,uy),x=cx+dx,y=cy+dy,sampleX=ux*sourceRadius*Math.min(width,height)*sourceAspect*(edit.flipX?-1:1),sampleY=uy*sourceRadius*Math.min(width,height),fromX=Math.round(sx+sampleX*Math.cos(sourceAngle)-sampleY*Math.sin(sourceAngle)),fromY=Math.round(sy+sampleX*Math.sin(sourceAngle)+sampleY*Math.cos(sourceAngle));
  if(distance>1||x<0||y<0||x>=width||y>=height||fromX<0||fromY<0||fromX>=width||fromY>=height)continue;
  const sampleDistance=edit.sourceShape==='rectangle'?Math.max(ax,ay):edit.sourceShape==='diamond'?ax+ay:edit.sourceShape==='hexagon'?Math.max(ax,ay,ax*.866+ay*.5):edit.sourceShape?Math.hypot(ux,uy):0;if(sampleDistance>1||edit.targetMask&&!edit.targetMask[y*width+x]||edit.sourceMask&&!edit.sourceMask[fromY*width+fromX])continue;
  const target=(y*width+x)*4,from=(fromY*width+fromX)*4,weight=edit.softness?Math.min(1,(1-distance)/edit.softness):1;
  const a=source.pixels[from+3]/255*weight,b=source.pixels[target+3]/255*(1-weight),alpha=a+b;
  for(let c=0;c<3;c++)pixels[target+c]=alpha?(source.pixels[from+c]*a+source.pixels[target+c]*b)/alpha:0;pixels[target+3]=alpha*255;
 }
 return {width,height,pixels};
}
