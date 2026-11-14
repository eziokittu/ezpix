import {validateRaster,type Raster} from './conversion.js';
import type {RGBA} from './document.js';

export const FRAME_STYLES=['solid','double','gallery','matte','polaroid','film','contact','pinstripe','stripes','diagonal','chevron','checker','dots','confetti','linen','paper','grain','marble','gradient','sunset','ocean','gold','vignette','corner'] as const;
export type FrameStyle=typeof FRAME_STYLES[number];
export function frameColor(style:FrameStyle,x:number,y:number,w:number,h:number,pad:number,base:RGBA):RGBA{
 const edge=Math.min(x,y,w-1-x,h-1-y)/Math.max(1,pad),u=x/Math.max(1,w),v=y/Math.max(1,h),unit=Math.max(2,Math.round(pad/3));
 const noise=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%255;
 let mix=0,ink:readonly number[]=[25,23,29];
 if(style==='double')mix=edge>.28&&edge<.42?.8:0;
 if(style==='gallery')mix=edge>.72?.85:edge<.12?.35:0;
 if(style==='matte')mix=edge>.84?.3:0;
 if(style==='polaroid')mix=y>h-pad&&y<h-pad*.3?.12:0;
 if(style==='film')mix=(x<pad*.7||x>w-pad*.7)&&Math.floor(y/unit)%3===0?.85:0;
 if(style==='contact')mix=(Math.floor(x/unit)%4===0||Math.floor(y/unit)%4===0)&&edge<.6?.8:0;
 if(style==='pinstripe')mix=Math.floor(edge*14)%3===0?.55:0;
 if(style==='stripes')mix=Math.floor(x/unit)%2?.5:0;
 if(style==='diagonal')mix=Math.floor((x+y)/unit)%2?.45:0;
 if(style==='chevron')mix=Math.floor((Math.abs(x-w/2)+y)/unit)%2?.45:0;
 if(style==='checker')mix=(Math.floor(x/unit)+Math.floor(y/unit))%2?.65:0;
 if(style==='dots')mix=Math.hypot(x%(unit*3)-unit*1.5,y%(unit*3)-unit*1.5)<unit*.5?.7:0;
 if(style==='confetti')mix=noise>235?.8:0;
 if(style==='linen')mix=(x%3===0||y%3===0)?.12:0;
 if(style==='paper')mix=noise/255*.15;
 if(style==='grain')mix=noise/255*.3;
 if(style==='marble')mix=(Math.sin(x*.06+Math.sin(y*.08)*3)+1)*.22;
 if(style==='gradient')mix=(u+v)*.25;
 if(style==='sunset'){ink=[239,111,98];mix=v*.8;}
 if(style==='ocean'){ink=[18,119,151];mix=(u+v)*.35;}
 if(style==='gold'){ink=[183,137,50];mix=.3+(Math.sin(edge*18)+1)*.25;}
 if(style==='vignette')mix=(1-Math.min(1,edge))*.65;
 if(style==='corner')mix=((x<pad*3||x>w-pad*3)&&(y<pad*3||y>h-pad*3))?.6:0;
 return [Math.round(base[0]*(1-mix)+ink[0]*mix),Math.round(base[1]*(1-mix)+ink[1]*mix),Math.round(base[2]*(1-mix)+ink[2]*mix),base[3]];
}
export type CollageCell={x:number;y:number;width:number;height:number;angle?:number;borderWidth?:number;borderColor?:RGBA;borderStyle?:FrameStyle;fit?:'cover'|'contain';zoom?:number;offsetX?:number;offsetY?:number};
type Cell=CollageCell;
export function validateCollageCells(cells:unknown):asserts cells is CollageCell[]{
 if(!Array.isArray(cells)||!cells.length||cells.length>16||cells.some(c=>!c||Object.keys(c).some(k=>!['x','y','width','height','angle','borderWidth','borderColor','borderStyle','fit','zoom','offsetX','offsetY'].includes(k))||['x','y','width','height'].some(k=>!Number.isFinite(c[k]))||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>1.000001||c.y+c.height>1.000001||c.angle!==undefined&&(!Number.isFinite(c.angle)||Math.abs(c.angle)>180)||c.borderWidth!==undefined&&(!Number.isFinite(c.borderWidth)||c.borderWidth<0||c.borderWidth>.15)||c.borderColor!==undefined&&(!Array.isArray(c.borderColor)||c.borderColor.length!==4||c.borderColor.some((n:number)=>!Number.isInteger(n)||n<0||n>255))||c.borderStyle!==undefined&&!FRAME_STYLES.includes(c.borderStyle)||c.fit!==undefined&&!['cover','contain'].includes(c.fit)||c.zoom!==undefined&&(!Number.isFinite(c.zoom)||c.zoom<1||c.zoom>8)||['offsetX','offsetY'].some(k=>c[k]!==undefined&&(!Number.isFinite(c[k])||Math.abs(c[k])>1))))throw Error('Choose 1 to 16 valid collage placeholders.');
}
const grid=(cols:number,rows:number):Cell[]=>Array.from({length:cols*rows},(_,i)=>({x:i%cols/cols,y:Math.floor(i/cols)/rows,width:1/cols,height:1/rows}));
export const COLLAGE_TEMPLATES:Record<string,{name:string;cells:Cell[]}>= {
 diptych:{name:'Side by side',cells:grid(2,1)},stack:{name:'Vertical pair',cells:grid(1,2)},triptych:{name:'Triptych',cells:grid(3,1)},strips:{name:'Three stories',cells:grid(1,3)},quad:{name:'Four squares',cells:grid(2,2)},six:{name:'Six moments',cells:grid(3,2)},sixTall:{name:'Six portraits',cells:grid(2,3)},nine:{name:'Nine stories',cells:grid(3,3)},
 feature:{name:'Feature left',cells:[{x:0,y:0,width:.66,height:1},{x:.66,y:0,width:.34,height:.5},{x:.66,y:.5,width:.34,height:.5}]},featureRight:{name:'Feature right',cells:[{x:.34,y:0,width:.66,height:1},{x:0,y:0,width:.34,height:.5},{x:0,y:.5,width:.34,height:.5}]},
 hero:{name:'Hero above',cells:[{x:0,y:0,width:1,height:.66},{x:0,y:.66,width:.5,height:.34},{x:.5,y:.66,width:.5,height:.34}]},heroBottom:{name:'Hero below',cells:[{x:0,y:.34,width:1,height:.66},{x:0,y:0,width:.5,height:.34},{x:.5,y:0,width:.5,height:.34}]},
 editorial:{name:'Editorial',cells:[{x:0,y:0,width:.6,height:.6},{x:.6,y:0,width:.4,height:.6},{x:0,y:.6,width:.4,height:.4},{x:.4,y:.6,width:.6,height:.4}]},panorama:{name:'Panorama & details',cells:[{x:0,y:0,width:1,height:.5},...grid(3,1).map(c=>({...c,y:.5,height:.5}))]},
 windows:{name:'Five windows',cells:[{x:0,y:0,width:.5,height:1},...grid(2,2).map(c=>({...c,x:.5+c.x*.5,width:.25}))]},storyboard:{name:'Story board',cells:[...grid(2,1).map(c=>({...c,height:.6})),...grid(3,1).map(c=>({...c,y:.6,height:.4}))]},
 pairWide:{name:'Wide feature pair',cells:[{x:0,y:0,width:.65,height:1},{x:.65,y:0,width:.35,height:1}]},
 pairTall:{name:'Tall feature pair',cells:[{x:0,y:0,width:1,height:.65},{x:0,y:.65,width:1,height:.35}]},
 insetPair:{name:'Picture in picture',cells:[{x:0,y:0,width:1,height:1},{x:.58,y:.58,width:.36,height:.36}]},
 overlapPair:{name:'Overlapping pair',cells:[{x:.03,y:.06,width:.65,height:.76},{x:.38,y:.36,width:.59,height:.59}]},
 layeredThree:{name:'Three layered moments',cells:[{x:0,y:0,width:1,height:1},{x:.06,y:.1,width:.36,height:.36},{x:.58,y:.54,width:.36,height:.4}]},
 overlapThree:{name:'Three overlapping cards',cells:[{x:.03,y:.05,width:.64,height:.68},{x:.37,y:.26,width:.6,height:.67},{x:.06,y:.65,width:.43,height:.32}]},
 threeSteps:{name:'Three stepped moments',cells:[{x:.03,y:.03,width:.7,height:.6},{x:.32,y:.34,width:.65,height:.6},{x:.03,y:.65,width:.38,height:.32}]},
 threeColumns:{name:'Unequal triptych',cells:[{x:0,y:0,width:.5,height:1},{x:.5,y:0,width:.3,height:1},{x:.8,y:0,width:.2,height:1}]},
};
export type CollageEdit={kind:'collage';template:string;images:Raster[];width:number;height:number;gap:number;color:RGBA;fit:'cover'|'contain';cells?:CollageCell[];slots?:(number|null)[];keepBackground?:boolean};
export function composeCollage(edit:CollageEdit,source?:Raster):Raster{
 if(edit.cells||edit.slots)return composeSlots(edit,source);
 const {width,height,images,gap,color,fit}=edit,template=Object.hasOwn(COLLAGE_TEMPLATES,edit.template)?COLLAGE_TEMPLATES[edit.template]:undefined;
 if(!template||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192||width*height>4_000_000||!Number.isFinite(gap)||gap<0||gap>.15||!['cover','contain'].includes(fit)||!images.length||images.length>9||color.length!==4||color.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('Choose a valid collage up to four megapixels and nine photos.');
 images.forEach(validateRaster);if(images.reduce((n,f)=>n+f.pixels.byteLength,0)>32*1024*1024)throw Error('Collage photos exceed 32 MiB.');
 const pixels=new Uint8ClampedArray(width*height*4);new Uint32Array(pixels.buffer).fill(new Uint32Array(Uint8Array.from(color).buffer)[0]);
 const border=Math.min(width,height)*gap;
 template.cells.forEach((cell,index)=>{const image=images[index%images.length],left=Math.round(cell.x*width+border),top=Math.round(cell.y*height+border),cw=Math.max(1,Math.round(cell.width*width-border*2)),ch=Math.max(1,Math.round(cell.height*height-border*2)),scale=fit==='cover'?Math.max(cw/image.width,ch/image.height):Math.min(cw/image.width,ch/image.height),ox=(cw-image.width*scale)/2,oy=(ch-image.height*scale)/2;
  // Each window has its own backing, including the border of overlapping cards.
  const overlaps=template.cells.some((other,i)=>i<index&&cell.x<other.x+other.width-1e-8&&other.x<cell.x+cell.width-1e-8&&cell.y<other.y+other.height-1e-8&&other.y<cell.y+cell.height-1e-8);
  if(overlaps)for(let y=Math.round(cell.y*height);y<Math.min(height,Math.round((cell.y+cell.height)*height));y++)for(let x=Math.round(cell.x*width);x<Math.min(width,Math.round((cell.x+cell.width)*width));x++)pixels.set(color,(y*width+x)*4);
  for(let y=0;y<ch&&top+y<height;y++)for(let x=0;x<cw&&left+x<width;x++){const sx=(x-ox)/scale,sy=(y-oy)/scale;if(sx<0||sy<0||sx>=image.width||sy>=image.height)continue;const src=(Math.floor(sy)*image.width+Math.floor(sx))*4,dst=((top+y)*width+left+x)*4,a=image.pixels[src+3]/255,da=pixels[dst+3]/255,oa=a+da*(1-a);if(oa){for(let c=0;c<3;c++)pixels[dst+c]=(image.pixels[src+c]*a+pixels[dst+c]*da*(1-a))/oa;pixels[dst+3]=oa*255;}}
 });return {width,height,pixels};
}
/** Explicit slots never repeat photos. Inverse mapping keeps rotated windows clipped and bounded. */
function composeSlots(edit:CollageEdit,source?:Raster):Raster{
 const {width,height,images,color,gap}=edit,cells=edit.cells??COLLAGE_TEMPLATES[edit.template]?.cells;
 validateCollageCells(cells);
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192||width*height>4_000_000||!Number.isFinite(gap)||gap<0||gap>.15||!['cover','contain'].includes(edit.fit)||images.length>16||color.length!==4||color.some(n=>!Number.isInteger(n)||n<0||n>255)||edit.keepBackground!==undefined&&typeof edit.keepBackground!=='boolean'||!Array.isArray(edit.slots)||edit.slots.length!==cells.length||edit.slots.some(n=>n!==null&&(!Number.isInteger(n)||n<0||n>=images.length)))throw Error('Invalid collage slots or canvas.');
 images.forEach(validateRaster);if(images.reduce((n,f)=>n+f.pixels.byteLength,0)>32*1024*1024)throw Error('Collage photos exceed 32 MiB.');
 const pixels=new Uint8ClampedArray(width*height*4);new Uint32Array(pixels.buffer).fill(new Uint32Array(Uint8Array.from(color).buffer)[0]);
 const blend=(x:number,y:number,r:number,g:number,b:number,alpha:number)=>{const i=(y*width+x)*4;if(alpha===0)return;if(alpha===255){pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255;return;}const a=alpha/255,d=pixels[i+3]/255,o=a+d*(1-a);if(o){pixels[i]=(r*a+pixels[i]*d*(1-a))/o;pixels[i+1]=(g*a+pixels[i+1]*d*(1-a))/o;pixels[i+2]=(b*a+pixels[i+2]*d*(1-a))/o;pixels[i+3]=o*255;}};
 if(edit.keepBackground&&source){validateRaster(source);const scale=Math.max(width/source.width,height/source.height),ox=(width-source.width*scale)/2,oy=(height-source.height*scale)/2;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const sx=Math.max(0,Math.min(source.width-1,Math.floor((x-ox)/scale))),sy=Math.max(0,Math.min(source.height-1,Math.floor((y-oy)/scale))),i=(sy*source.width+sx)*4;blend(x,y,source.pixels[i],source.pixels[i+1],source.pixels[i+2],source.pixels[i+3]);}}
 cells.forEach((cell,index)=>{const imageIndex=edit.slots![index];if(imageIndex===null)return;const image=images[imageIndex],pad=Math.min(width,height)*gap,bw=Math.min(width,height)*(cell.borderWidth??0),cw=Math.max(1,cell.width*width-pad*2),ch=Math.max(1,cell.height*height-pad*2),cx=(cell.x+cell.width/2)*width,cy=(cell.y+cell.height/2)*height,rad=(cell.angle??0)*Math.PI/180,co=Math.cos(rad),si=Math.sin(rad),extentX=(Math.abs(co)*cw+Math.abs(si)*ch)/2,extentY=(Math.abs(si)*cw+Math.abs(co)*ch)/2,iw=Math.max(1,cw-bw*2),ih=Math.max(1,ch-bw*2),scale=((cell.fit??edit.fit)==='cover'?Math.max(iw/image.width,ih/image.height):Math.min(iw/image.width,ih/image.height))*(cell.zoom??1),ox=(iw-image.width*scale)/2+(cell.offsetX??0)*iw,oy=(ih-image.height*scale)/2+(cell.offsetY??0)*ih;
 for(let y=Math.max(0,Math.floor(cy-extentY));y<Math.min(height,Math.ceil(cy+extentY));y++)for(let x=Math.max(0,Math.floor(cx-extentX));x<Math.min(width,Math.ceil(cx+extentX));x++){const dx=x+.5-cx,dy=y+.5-cy,u=co*dx+si*dy+cw/2,v=-si*dx+co*dy+ch/2;if(u<0||v<0||u>=cw||v>=ch)continue;
 if(u<bw||v<bw||u>=cw-bw||v>=ch-bw){const c=frameColor(cell.borderStyle??'solid',u,v,cw,ch,bw,cell.borderColor??[255,255,255,255]);blend(x,y,...c);continue;}
 const sx=(u-bw-ox)/scale,sy=(v-bw-oy)/scale;if(sx<0||sy<0||sx>=image.width||sy>=image.height){blend(x,y,...color);continue;}const p=(Math.floor(sy)*image.width+Math.floor(sx))*4;blend(x,y,image.pixels[p],image.pixels[p+1],image.pixels[p+2],image.pixels[p+3]);}
 });return {width,height,pixels};
}
export function snapValue(value:number,targets:readonly number[],tolerance:number){if(!Number.isFinite(value))return value;let best=value,distance=tolerance;for(const target of targets){const delta=Math.abs(target-value);if(delta<=distance){best=target;distance=delta;}}return best;}
export function stampVisible(edit:{x:number;y:number;size:number;angle:number;image:Raster},width:number,height:number){const w=Math.min(width,height)*edit.size,h=w*edit.image.height/edit.image.width,a=edit.angle*Math.PI/180,rx=(Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a)))/2,ry=(Math.abs(h*Math.cos(a))+Math.abs(w*Math.sin(a)))/2,cx=edit.x*(width-1),cy=edit.y*(height-1);return cx+rx>0&&cy+ry>0&&cx-rx<width&&cy-ry<height;}
