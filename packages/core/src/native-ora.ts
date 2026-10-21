import {createDocument,makeLayer,checkCelBudget,composite,type PixelDocument} from './document.js';
import {name,integer,fail} from './native-utils.js';
import {encodeNativePng,decodeNativePng} from './native-png.js';
import {readNativeZip,writeNativeZip} from './native-zip.js';
import {layerExportSnapshot,type LayerExportMode} from './layer-exchange.js';
import type {NativeImport} from './native-aseprite.js';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function entity(s:string){return s.replace(/&([^;]+);/g,(_,e:string)=>{const v:{[k:string]:string}={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(v[e])return v[e];const n=e.startsWith('#x')?parseInt(e.slice(2),16):e.startsWith('#')?Number(e.slice(1)):NaN;if(!Number.isInteger(n)||n<32||n>0x10ffff||n>=0xd800&&n<=0xdfff)fail('Unsupported XML entity.');return String.fromCodePoint(n);});}
/** Deliberate flat XML grammar: no DTD, entities, nested groups, extensions or external resources. */
function parseStack(xml:string){
 if(xml.length>32768||/<!DOCTYPE|<!ENTITY/i.test(xml))fail('ORA XML exceeds limits or contains a DTD.');
 xml=xml.replace(/^\uFEFF/,'').replace(/^\s*<\?xml\s[^?]*\?>/,'').replace(/<!--[\s\S]*?-->/g,'');
 const tags=xml.match(/<[^>]*>/g)??[];if(xml.replace(/<[^>]*>/g,'').trim())fail('Unexpected ORA XML text.');
 const parse=(tag:string,kind:string,allowed:string[])=>{const m=new RegExp(`^<${kind}\\b([\\s\\S]*?)\\s*${kind==='layer'?'/':''}>$`).exec(tag);if(!m)fail('Unsupported ORA structure or groups.');const attrs:Record<string,string>={};let tail=m[1];while(tail.trim()){const a=/^\s+([\w:-]+)\s*=\s*("([^"<&]*)"|'([^'<&]*)'|"([^"]*)"|'([^']*)')/.exec(tail);if(!a||!allowed.includes(a[1])||a[1]in attrs)fail('Unsupported ORA attribute.');const raw=a[3]??a[4]??a[5]??a[6];if(/<|&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(raw))fail('Invalid ORA XML entity.');attrs[a[1]]=entity(raw);tail=tail.slice(a[0].length);}return attrs;};
 if(tags.length<5||tags[1]!=='<stack>'||tags.at(-2)!=='</stack>'||tags.at(-1)!=='</image>')fail('ORA requires one flat normal stack.');
 const image=parse(tags[0]!,'image',['w','h','name','version','xres','yres']);if(!/^0\.0\.[1-6]$/.test(image.version??''))fail('Unsupported ORA version.');
 const layers=tags.slice(2,-2).map(t=>parse(t,'layer',['name','src','x','y','opacity','visibility','composite-op','selected']));return {image,layers};
}
export async function decodeOra(bytes:Uint8Array,title='Imported OpenRaster'):Promise<NativeImport>{
 const files=await readNativeZip(bytes);if(dec.decode(files.get('mimetype'))!=='image/openraster'||!files.has('stack.xml'))fail('Not an OpenRaster archive.');
 const {image,layers}=parseStack(dec.decode(files.get('stack.xml'))),width=integer(Number(image.w),1,256,'Width'),height=integer(Number(image.h),1,256,'Height');checkCelBudget(width,height,layers.length,1);
 const doc=createDocument(width,height,name(image.name??title));doc.layers=[];const used=new Set(['mimetype','stack.xml','mergedimage.png','Thumbnails/thumbnail.png']);
 for(const [i,l]of layers.slice().reverse().entries()){
  if((l['composite-op']??'svg:src-over')!=='svg:src-over'||!Number.isFinite(Number(l.opacity??1))||Number(l.opacity??1)<0||Number(l.opacity??1)>1||!['visible','hidden'].includes(l.visibility??'visible'))fail('ORA blends and partial layer opacity are unsupported.');
  if(Number(l.x??0)!==0||Number(l.y??0)!==0)fail('ORA layer offsets are unsupported in this slice.');
  if(!l.src||!/^data\/[\w.-]+\.png$/.test(l.src)||used.has(l.src)||!files.has(l.src))fail('Missing, duplicate or unsupported ORA layer image.');used.add(l.src);
  const pixels=await decodeNativePng(files.get(l.src)!,width,height);doc.layers.push(makeLayer(doc,`layer-${i+1}`,name(l.name??`Layer ${i+1}`),l.visibility!=='hidden',{'frame-1':pixels},{opacity:Math.round(Number(l.opacity??1)*255)}));
 }for(const path of files.keys())if(!used.has(path))fail('Unsupported ORA archive content.');doc.activeLayerId=doc.layers.at(-1)!.id;
 return {document:doc,warnings:['OpenRaster imports one static frame; timing, palette swatches and resolution metadata are not retained.',...(layers.some(l=>Math.abs(Number(l.opacity??1)*255-Math.round(Number(l.opacity??1)*255))>1e-7)?['Layer opacity is rounded to the nearest 8-bit (0-255) value.']:[])]};
}
export async function encodeOra(source:PixelDocument,mode:LayerExportMode='selected-frame'){
 const {document:doc,warnings}=layerExportSnapshot(source,mode),files=new Map<string,Uint8Array>([['mimetype',enc.encode('image/openraster')]]),tags:string[]=[];
 for(const [i,l]of doc.layers.entries()){const path=`data/layer${i}.png`;files.set(path,await encodeNativePng(doc.width,doc.height,l.pixels));tags.unshift(`<layer name="${escape(l.name)}" src="${path}" x="0" y="0" opacity="${l.opacity/255}" visibility="${l.visible?'visible':'hidden'}" composite-op="svg:src-over"/>`);}
 files.set('stack.xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><image version="0.0.3" w="${doc.width}" h="${doc.height}" name="${escape(doc.name)}"><stack>${tags.join('')}</stack></image>`));const png=await encodeNativePng(doc.width,doc.height,composite(doc));files.set('mergedimage.png',png);files.set('Thumbnails/thumbnail.png',png);return {bytes:writeNativeZip(files),warnings};
}
