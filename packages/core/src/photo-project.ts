import {PhotoWorkspace,type PhotoSnapshot} from './photo-workspace.js';

const maxBytes=32*1024*1024;
/** Separate photo format: never masquerades as a PixelDocument .ezpix file. */
export function encodePhotoProject(value:PhotoSnapshot):string {
 const checked=new PhotoWorkspace(value.original);checked.restore(value);
 const text=JSON.stringify(value,(_key,value)=>{
  if(value instanceof Uint8Array||value instanceof Uint8ClampedArray){let binary='';for(let i=0;i<value.length;i+=8192)binary+=String.fromCharCode(...value.subarray(i,i+8192));return {bytes:btoa(binary),type:value instanceof Uint8ClampedArray?'rgba':'mask'};}
  return value;
 });
 if(text.length>maxBytes)throw Error('Editable photo export exceeds 32 MiB. Local autosave is still available.');return text;
}
export function decodePhotoProject(text:string):PhotoSnapshot {
 if(typeof text!=='string'||text.length>maxBytes)throw Error('Photo project exceeds 32 MiB.');let allocated=0;
 const value=JSON.parse(text,(_key,value)=>{
  if(value&&typeof value==='object'&&'bytes' in value){if(Object.keys(value).length!==2||!['rgba','mask'].includes(value.type)||typeof value.bytes!=='string'||value.bytes.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.bytes))throw Error('Invalid photo byte encoding.');const binary=atob(value.bytes);allocated+=binary.length;if(allocated>64*1024*1024)throw Error('Decoded photo layers exceed 64 MiB.');return value.type==='rgba'?Uint8ClampedArray.from(binary,c=>c.charCodeAt(0)):Uint8Array.from(binary,c=>c.charCodeAt(0));}return value;
 }) as PhotoSnapshot;
 const checked=new PhotoWorkspace(value.original);checked.restore(value);return checked.snapshot();
}
