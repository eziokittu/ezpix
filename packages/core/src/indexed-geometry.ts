import {createDocument,checkCelBudget,encodeProject,type PixelDocument} from './document.js';
import {resolveCanvasGeometry,type CanvasGeometryOptions,type CanvasGeometryPlan} from './canvas-geometry.js';
import {validateIndexedDocument,refreshIndexedCaches} from './indexed-document.js';
import {prepareAuthored,type AuthoredPlan} from './authored-workflows.js';
import {permuteRaster} from './raster-transform.js';
import {copyIndexedCel,decodeIndexedCelPng,type IndexedCel} from './indexed-cel.js';
export type IndexedGeometryOperation={kind:'indexed-geometry';options:CanvasGeometryOptions};
const plans=new WeakMap<CanvasGeometryPlan,{options:CanvasGeometryOptions;authored:AuthoredPlan}>();
export function indexedGeometryOperation(doc:PixelDocument,o:IndexedGeometryOperation){
 validateIndexedDocument(doc);const v=doc.indexed;if(!v)throw new Error('Enter indexed storage first.');if(doc.slices?.length)throw new Error('Clear sprite slices before changing indexed canvas geometry.');const g=resolveCanvasGeometry(doc,o.options),w=doc.width,h=doc.height;checkCelBudget(g.width,g.height,doc.layers.length,doc.frames.length);
 const padding=g.options.kind==='resize'&&(g.x<0||g.y<0||g.x+g.width>w||g.y+g.height>h);if(padding&&v.transparentIndex===null)throw new Error('Indexed canvas padding needs a transparent slot.');
 for(const c of Object.values(v.cels)){const seen=new Map<Uint8Array,Uint8Array>();for(const id of Object.keys(c)){const p=c[id];let out=seen.get(p);if(!out){const opt=g.options;if(opt.kind==='rotate'||opt.kind==='flip'||opt.kind==='scale')out=new Uint8Array(permuteRaster(p,w,h,g.width,g.height,opt.kind==='rotate'?opt.rotation:0,opt.kind==='flip'&&opt.axis==='horizontal',opt.kind==='flip'&&opt.axis==='vertical',1));else{out=new Uint8Array(g.width*g.height).fill(v.transparentIndex??0);for(let y=0;y<g.height;y++)for(let x=0;x<g.width;x++){const sx=x+g.x,sy=y+g.y;if(sx>=0&&sy>=0&&sx<w&&sy<h)out[y*g.width+x]=p[sy*w+sx];}}seen.set(p,out);}c[id]=out;}}
 doc.width=g.width;doc.height=g.height;if(doc.conversion)doc.conversion={...doc.conversion,recipe:{...doc.conversion.recipe,width:g.width,height:g.height}};refreshIndexedCaches(doc);
}
export function prepareIndexedGeometry(doc:PixelDocument,options:CanvasGeometryOptions,budget=8*1024*1024):CanvasGeometryPlan{validateIndexedDocument(doc);if(!doc.indexed)throw new Error('Enter indexed storage first.');const g=resolveCanvasGeometry(doc,options),authored=prepareAuthored(doc,{kind:'indexed-geometry',options:g.options},budget);let clippedPixels=0;if(['resize','crop','trim'].includes(g.options.kind))for(const c of Object.values(doc.indexed.cels))for(const p of new Set(Object.values(c)))for(let i=0;i<p.length;i++)if(p[i]!==doc.indexed.transparentIndex&&(i%doc.width<g.x||i%doc.width>=g.x+g.width||Math.floor(i/doc.width)<g.y||Math.floor(i/doc.width)>=g.y+g.height))clippedPixels++;
 const plan=Object.freeze({...g,baseline:authored.baseline,changed:authored.changed,historyBytes:authored.historyBytes,clippedPixels,get preview(){return authored.preview;}});plans.set(plan,{options:structuredClone(g.options),authored});return plan;
}
export function indexedGeometryAuthored(doc:PixelDocument,plan:CanvasGeometryPlan,budget:number){const p=plans.get(plan);if(!p||plan.baseline!==encodeProject(doc,false))throw new Error('Indexed canvas source changed. Prepare again.');return prepareAuthored(doc,{kind:'indexed-geometry',options:p.options},budget);}
export function createIndexedDocument(input:IndexedCel,name='Imported indexed PNG'){const c=copyIndexedCel(input),doc=createDocument(c.width,c.height,name);doc.indexed={palette:c.palette.map(p=>[...p]),transparentIndex:c.transparentIndex,cels:{[doc.activeLayerId]:{[doc.activeFrameId]:new Uint8Array(c.indices)}}};refreshIndexedCaches(doc);encodeProject(doc,false);return doc;}
export async function decodeIndexedPngDocument(bytes:Uint8Array,name?:string){return createIndexedDocument(await decodeIndexedCelPng(bytes),name);}
