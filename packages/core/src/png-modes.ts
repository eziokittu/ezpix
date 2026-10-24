import type {Raster} from './conversion.js';
import {encodeProject} from './document.js';
import {rasterImport} from './raster-exchange.js';
import {pngChunk,decodeNativePng} from './native-png.js';
import {decodeApng} from './native-apng.js';
import {boundedBytes,integer,fail,concat,deflate} from './native-utils.js';
const signature=Uint8Array.of(137,80,78,71,13,10,26,10);
export const PNG_MODE_NOTE='Grayscale PNG stores 8-bit gray plus full alpha and requires already-gray composite pixels. Exact indexed PNG builds at most 256 unique RGBA entries in first-appearance order; repeated RGB at different alpha uses separate entries. It never silently quantizes alpha or colours and rejects larger RGBA sets. Imported PNG becomes editable RGBA, not indexed storage. Save an EzPix project to retain output mode, layers and source.';
export async function encodeModePng(r:Raster,kind:'grayscale'|'indexed'){
 integer(r.width,1,2048,'PNG width');integer(r.height,1,2048,'PNG height');if(r.width*r.height>1048576||r.pixels.length!==r.width*r.height*4)fail('PNG raster exceeds one megapixel or invalid byte count.');if(!['grayscale','indexed'].includes(kind))fail('Choose grayscale or indexed PNG.');
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,r.width);view.setUint32(4,r.height);header[8]=8;header[9]=kind==='grayscale'?4:3;const channels=kind==='grayscale'?2:1,rows=new Uint8Array((r.width*channels+1)*r.height),entries:number[][]=[],indices=new Map<number,number>();
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=(y*r.width+x)*4,at=y*(r.width*channels+1)+1+x*channels;if(kind==='grayscale'){if(r.pixels[i]!==r.pixels[i+1]||r.pixels[i]!==r.pixels[i+2])fail('Grayscale PNG requires gray composite pixels. Apply grayscale document output first, or export RGBA PNG.');rows[at]=r.pixels[i];rows[at+1]=r.pixels[i+3];}else{const key=((r.pixels[i]<<24)|(r.pixels[i+1]<<16)|(r.pixels[i+2]<<8)|r.pixels[i+3])>>>0;let index=indices.get(key);if(index===undefined){if(entries.length===256)fail('Exact indexed PNG exceeds 256 unique RGBA entries. Reduce colours/alpha variants or use RGBA PNG.');index=entries.length;entries.push(Array.from(r.pixels.subarray(i,i+4)));indices.set(key,index);}rows[at]=index;}}
 const extra=kind==='indexed'?[pngChunk('PLTE',Uint8Array.from(entries.flatMap(p=>p.slice(0,3)))),pngChunk('tRNS',Uint8Array.from(entries.map(p=>p[3])))]:[];const bytes=concat([signature,pngChunk('IHDR',header),...extra,pngChunk('IDAT',await deflate(rows)),pngChunk('IEND',new Uint8Array())]);if(bytes.length>8*1024*1024)fail('PNG exceeds 8 MiB encoded budget.');return bytes;
}
export async function decodePngProject(input:Uint8Array){
 boundedBytes(input);const bytes=input.slice();if(bytes.length<33||!signature.every((n,i)=>bytes[i]===n))fail('PNG needs a valid header.');const v=new DataView(bytes.buffer),width=integer(v.getUint32(16),1,256,'PNG width'),height=integer(v.getUint32(20),1,256,'PNG height');let at=8,count=0,animated=false;
 while(at+12<=bytes.length){if(++count>4096)fail('PNG exceeds 4096 chunks.');const n=v.getUint32(at),end=at+n+12;if(end>bytes.length)fail('Truncated PNG chunk.');if(String.fromCharCode(...bytes.subarray(at+4,at+8))==='acTL')animated=true;at=end;}
 if(animated)return decodeApng(bytes);const result=rasterImport({width,height,pixels:await decodeNativePng(bytes,width,height)},'Imported PNG');result.warnings.push('PNG palette indices are expanded to RGBA; grayscale/colour profile and document output mode are not inferred.');encodeProject(result.document,false);return result;
}
