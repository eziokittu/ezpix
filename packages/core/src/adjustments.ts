import {activeLayer,composite,encodeProject,linkedFrames,rasterCel,type PixelDocument} from './document.js';
import {layerEditable} from './groups.js';
import {adjustOklch,type OklchAdjustment} from './oklch.js';
import {validatePalette} from './toolkit.js';
import {nearestPalettePixel,orderedPaletteOffset} from './palette-map.js';
export type {OklchAdjustment} from './oklch.js';
export interface HslAdjustment {kind:'hsl';hue:number;saturation:number;lightness:number}
export interface LevelsSettings {inputBlack:number;inputWhite:number;gamma:number;outputBlack:number;outputWhite:number}
export type LevelsChannel='red'|'green'|'blue';
export interface LevelsAdjustment extends LevelsSettings {kind:'levels';channels?:Readonly<Record<LevelsChannel,Readonly<LevelsSettings>>>}
export const IDENTITY_LEVELS:Readonly<LevelsSettings>=Object.freeze({inputBlack:0,inputWhite:255,gamma:1,outputBlack:0,outputWhite:255});
export interface CurvePoint {readonly input:number;readonly output:number}
export type CurveChannel='red'|'green'|'blue';
export interface CurvesAdjustment {kind:'curves';points:ReadonlyArray<CurvePoint>;channels?:Readonly<Record<CurveChannel,ReadonlyArray<CurvePoint>>>}
export interface PaletteAdjustment {kind:'palette';colors:ReadonlyArray<string>}
export interface DitherAdjustment {kind:'dither';colors:ReadonlyArray<string>;strength:number}
export type ColourAdjustment=HslAdjustment|LevelsAdjustment|CurvesAdjustment|OklchAdjustment|PaletteAdjustment|DitherAdjustment;
export const MAX_CURVE_POINTS=16;
/** Strictly ordered full-domain points; integer rational interpolation, nearest ties up. */
export function curveLookup(points:ReadonlyArray<CurvePoint>):number[]{
 if(!Array.isArray(points)||points.length<2||points.length>MAX_CURVE_POINTS)throw new Error('Curves need 2-16 control points.');
 for(let i=0;i<points.length;i++){const p=points[i];if(!p||![p.input,p.output].every(n=>Number.isInteger(n)&&n>=0&&n<=255)||(i>0&&p.input<=points[i-1].input))throw new Error('Curve inputs must increase strictly; input/output values must be whole 0-255.');}
 if(points[0].input!==0||points[points.length-1].input!==255)throw new Error('Curve input endpoints must be 0 and 255.');
 let segment=0;return Array.from({length:256},(_,x)=>{while(segment<points.length-2&&x>points[segment+1].input)segment++;const a=points[segment],b=points[segment+1],span=b.input-a.input,numerator=a.output*(b.input-x)+b.output*(x-a.input);return Math.floor((2*numerator+span)/(2*span));});
}
export interface AdjustmentPlan {readonly baseline:string;readonly options:Readonly<ColourAdjustment>;readonly pixels:Uint8ClampedArray;readonly linked:number;readonly changedPixels:number}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Encoded-sRGB levels; nearest byte, upward half ties within 1e-10 byte. */
export function levelsLookup(options:Readonly<LevelsSettings>):number[]{
 if(!options||typeof options!=='object')throw new Error('Levels settings are missing.');
 const {inputBlack,inputWhite,gamma,outputBlack,outputWhite}=options;
 if(![inputBlack,inputWhite,outputBlack,outputWhite].every(n=>Number.isInteger(n)&&n>=0&&n<=255)||inputBlack>=inputWhite||outputBlack>outputWhite||!Number.isFinite(gamma)||gamma<.1||gamma>10)throw new Error('Levels need input black < white, output black <= white (whole 0-255), and gamma 0.1-10.');
 return Array.from({length:256},(_,v)=>Math.floor(outputBlack+(outputWhite-outputBlack)*Math.pow(clamp((v-inputBlack)/(inputWhite-inputBlack)),1/gamma)+.5+1e-10));
}
/** Quantization snaps numerical half-byte ties within 1e-10 upward.
 * Conventional HSL on encoded sRGB, percentage-point S/L offsets; achromatic hue starts at zero. */
function hsl(r:number,g:number,b:number,o:HslAdjustment):number[]{
 if(o.hue===0&&o.saturation===0&&o.lightness===0)return [r,g,b];
 r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
 let h=d===0?0:hi===r?((g-b)/d)%6:hi===g?(b-r)/d+2:(r-g)/d+4;
 h=((h*60+o.hue)%360+360)%360/60;
 const s=clamp((d===0?0:d/(1-Math.abs(2*l-1)))+o.saturation/100),light=clamp(l+o.lightness/100),c=(1-Math.abs(2*light-1))*s,x=c*(1-Math.abs(h%2-1)),m=light-c/2;
 const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return rgb.map(v=>Math.floor((v+m)*255+0.5+1e-10));
}
export function prepareAdjustment(doc:PixelDocument,options:ColourAdjustment):AdjustmentPlan {
 if(!options)throw new Error('Adjustment settings are missing.');
 let settings:Readonly<ColourAdjustment>,table:number[]|null=null,palette:number[][]|null=null,channelTables:number[][]|null=null;
 if(options.kind==='hsl'){
  if(!Number.isInteger(options.hue)||Math.abs(options.hue)>180||![options.saturation,options.lightness].every(n=>Number.isInteger(n)&&Math.abs(n)<=100))throw new Error('HSL needs whole hue offsets -180 to 180 and saturation/lightness offsets -100 to 100.');
  settings=Object.freeze({kind:options.kind,hue:options.hue,saturation:options.saturation,lightness:options.lightness});
 }else if(options.kind==='levels'){
  table=levelsLookup(options);
  const copy=(o:Readonly<LevelsSettings>)=>Object.freeze({inputBlack:o.inputBlack,inputWhite:o.inputWhite,gamma:o.gamma,outputBlack:o.outputBlack,outputWhite:o.outputWhite});
  if(options.channels!==undefined){
   if(!options.channels||typeof options.channels!=='object')throw new Error('Channel levels need red, green and blue settings.');
   channelTables=(['red','green','blue'] as const).map(key=>{try{return levelsLookup(options.channels![key]);}catch(error){throw new Error(`${key} channel: ${error instanceof Error?error.message:'Invalid levels.'}`);}});
   settings=Object.freeze({kind:options.kind,...copy(options),channels:Object.freeze({red:copy(options.channels.red),green:copy(options.channels.green),blue:copy(options.channels.blue)})});
  }else settings=Object.freeze({kind:options.kind,...copy(options)});
 }else if(options.kind==='curves'){
  table=curveLookup(options.points);
  const copy=(points:ReadonlyArray<CurvePoint>)=>Object.freeze(points.map(p=>Object.freeze({input:p.input,output:p.output})));
  if(options.channels!==undefined){
   if(!options.channels||typeof options.channels!=='object')throw new Error('Channel curves need red, green and blue point arrays.');
   channelTables=(['red','green','blue'] as const).map(key=>curveLookup(options.channels![key]));
   settings=Object.freeze({kind:options.kind,points:copy(options.points),channels:Object.freeze({red:copy(options.channels.red),green:copy(options.channels.green),blue:copy(options.channels.blue)})});
  }else settings=Object.freeze({kind:options.kind,points:copy(options.points)});
 }else if(options.kind==='oklch'){
  if(!Number.isInteger(options.hue)||Math.abs(options.hue)>180||!Number.isInteger(options.chroma)||Math.abs(options.chroma)>40||!Number.isInteger(options.lightness)||Math.abs(options.lightness)>100)throw new Error('OKLCH needs whole hue offsets -180 to 180, chroma offsets -40 to 40, and lightness offsets -100 to 100.');
  settings=Object.freeze({kind:options.kind,hue:options.hue,chroma:options.chroma,lightness:options.lightness});
 }else if(options.kind==='palette'||options.kind==='dither'){
  if(options.kind==='dither'&&(!Number.isInteger(options.strength)||options.strength<0||options.strength>100))throw new Error('Dither strength must be a whole number from 0 to 100.');
  const colors=validatePalette(options.colors);settings=options.kind==='dither'?Object.freeze({kind:options.kind,colors:Object.freeze(colors),strength:options.strength}):Object.freeze({kind:options.kind,colors:Object.freeze(colors)});palette=colors.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
 }else throw new Error('Unknown colour adjustment.');
 const layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer before adjusting colour.');
 const source=rasterCel(doc,layer),pixels=source.slice();let changedPixels=0;
 for(let i=0;i<pixels.length;i+=4){
  if(source[i+3]===0)continue;
  let rgb:number[];
  if(settings.kind==='palette'||settings.kind==='dither'){
   rgb=nearestPalettePixel([source[i],source[i+1],source[i+2]],palette!,settings.kind==='dither'?orderedPaletteOffset(i/4%doc.width,Math.floor(i/4/doc.width),settings.strength):0,settings.kind==='dither');
  }else if(settings.kind==='oklch')rgb=adjustOklch(source[i],source[i+1],source[i+2],settings);
  else if(settings.kind==='hsl')rgb=hsl(source[i],source[i+1],source[i+2],settings);
  else {rgb=[table![source[i]],table![source[i+1]],table![source[i+2]]];if(channelTables)rgb=rgb.map((v,k)=>channelTables![k][v]);}
  pixels.set(rgb,i);if(rgb.some((v,k)=>v!==source[i+k]))changedPixels++;
 }
 return Object.freeze({baseline:encodeProject(doc,false),options:settings,pixels,linked:linkedFrames(doc,layer).length,changedPixels});
}
export function adjustmentPreview(doc:PixelDocument,plan:AdjustmentPlan){return composite({...doc,layers:doc.layers.map(l=>l.id===doc.activeLayerId?{...l,cels:{...l.cels,[doc.activeFrameId]:plan.pixels}}:l)});}
