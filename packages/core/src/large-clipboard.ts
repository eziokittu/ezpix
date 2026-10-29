import {cloneLargeMask,validateLargeMask,type LargeMask} from './large-mask.js';

export const LARGE_CLIPBOARD_BYTES=8*1024*1024;
export interface LargeClipboard {
 readonly width:number;readonly height:number;readonly pixels:Uint8ClampedArray;
 readonly membership:Uint8Array;
 readonly indexed?:{readonly palette:readonly (readonly number[])[];readonly transparentIndex:number;readonly indices:Uint8Array};
}
export type ClipboardData={mask:LargeMask;pixels:Uint8ClampedArray;indexed?:undefined}|{mask:LargeMask;indices:Uint8Array;palette:number[][];transparentIndex:number;indexed:true};
const clips=new WeakMap<LargeClipboard,ClipboardData>();
const bytes=(b:Uint8Array|Uint8ClampedArray)=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
function decodeBytes(value:unknown,length:number){if(typeof value!=='string'||value.length!==Math.ceil(length/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Invalid clipboard byte plane.');const text=atob(value);if(text.length!==length||btoa(text)!==value)throw Error('Invalid clipboard base64.');return Uint8Array.from(text,c=>c.charCodeAt(0));}
function checkPalette(p:number[][],role:number){if(!Array.isArray(p)||p.length<1||p.length>256||Array.from(p).some(c=>!Array.isArray(c)||c.length!==4||Array.from(c).some(v=>!Number.isInteger(v)||v<0||v>255))||!Number.isInteger(role)||!p[role]||p[role][3]!==0)throw Error('Invalid clipboard palette or transparent role.');}
function clone(data:ClipboardData):ClipboardData{return data.indexed?{indexed:true,mask:cloneLargeMask(data.mask),indices:Uint8Array.from(data.indices),palette:data.palette.map(c=>[...c]),transparentIndex:data.transparentIndex}:{mask:cloneLargeMask(data.mask),pixels:new Uint8ClampedArray(data.pixels)};}
function render(data:ClipboardData){if(!data.indexed)return data.pixels.slice();const out=new Uint8ClampedArray(data.indices.length*4);for(let i=0;i<data.indices.length;i++)if(data.mask.bits[i])out.set(data.palette[data.indices[i]],i*4);return out;}
/** Internal factory snapshots every plane; public getters never expose the backing copy. */
export function createLargeClipboard(input:ClipboardData):LargeClipboard{
 validateLargeMask(input.mask);const n=input.mask.bits.length;
 if(input.indexed){checkPalette(input.palette,input.transparentIndex);if(!(input.indices instanceof Uint8Array)||input.indices.length!==n||input.indices.some(v=>v>=input.palette.length))throw Error('Invalid clipboard slot plane.');}
 else if(!(input.pixels instanceof Uint8ClampedArray)||input.pixels.length!==n*4)throw Error('Invalid clipboard RGBA plane.');
 const data=clone(input);data.mask.rect={x:0,y:0,width:data.mask.rect.width,height:data.mask.rect.height};
 for(let i=0;i<n;i++)if(!data.mask.bits[i]){if(data.indexed)data.indices[i]=data.transparentIndex;else data.pixels.fill(0,i*4,i*4+4);}
 const indexed=data.indexed?Object.freeze({palette:Object.freeze(data.palette.map(c=>Object.freeze([...c]))),transparentIndex:data.transparentIndex,get indices(){return data.indices.slice();}}):undefined;
 const out=Object.freeze({width:data.mask.rect.width,height:data.mask.rect.height,get pixels(){return render(data);},get membership(){return data.mask.bits.slice();},...(indexed?{indexed}:{})});clips.set(out,data);return out;
}
/** Internal reads are defensive too; even direct module consumers cannot modify the handle. */
export function readLargeClipboard(clip:LargeClipboard):ClipboardData{const data=clips.get(clip);if(!data)throw Error('Clipboard is unavailable.');return clone(data);}
export function encodeLargeClipboard(clip:LargeClipboard){const data=readLargeClipboard(clip),text=JSON.stringify({format:'ezpix-tiled-clipboard',version:1,width:clip.width,height:clip.height,membership:bytes(data.mask.bits),...(data.indexed?{mode:'indexed',palette:data.palette,transparentIndex:data.transparentIndex,indices:bytes(data.indices)}:{mode:'rgba',rgba:bytes(data.pixels)})});if(new TextEncoder().encode(text).length>LARGE_CLIPBOARD_BYTES)throw Error('Clipboard file exceeds 8 MiB.');return text;}
export function decodeLargeClipboard(text:string):LargeClipboard{
 if(typeof text!=='string'||text.length>LARGE_CLIPBOARD_BYTES||new TextEncoder().encode(text).length>LARGE_CLIPBOARD_BYTES)throw Error('Clipboard file exceeds 8 MiB.');const v=JSON.parse(text);
 const indexed=v?.mode==='indexed',keys=indexed?'format,height,indices,membership,mode,palette,transparentIndex,version,width':'format,height,membership,mode,rgba,version,width';
 if(!v||v.format!=='ezpix-tiled-clipboard'||v.version!==1||!['rgba','indexed'].includes(v.mode)||Object.keys(v).sort().join()!==keys||![v.width,v.height].every(n=>Number.isInteger(n)&&n>=1&&n<=10240)||v.width*v.height>1048576)throw Error('Invalid clipboard file.');
 if(indexed)checkPalette(v.palette,v.transparentIndex);const n=v.width*v.height,mask={rect:{x:0,y:0,width:v.width,height:v.height},bits:decodeBytes(v.membership,n)};validateLargeMask(mask);
 if(indexed){const indices=decodeBytes(v.indices,n);if(indices.some((x,i)=>x>=v.palette.length||!mask.bits[i]&&x!==v.transparentIndex))throw Error('Clipboard holes must use the transparent slot.');return createLargeClipboard({indexed:true,mask,indices,palette:v.palette,transparentIndex:v.transparentIndex});}
 const pixels=new Uint8ClampedArray(decodeBytes(v.rgba,n*4));if(pixels.some((x,i)=>!mask.bits[Math.floor(i/4)]&&x!==0))throw Error('RGBA clipboard holes must contain zero bytes.');return createLargeClipboard({mask,pixels});
}
