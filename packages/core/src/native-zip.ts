import {boundedBytes,concat,fail,MAX_NATIVE_BYTES} from './native-utils.js';
import {crc32} from './native-png.js';
const text=new TextEncoder(),decode=new TextDecoder('utf-8',{fatal:true});
export const MAX_ARCHIVE_EXPANSION=8*1024*1024;
function safePath(s:string){if(!s||s.length>160||s.includes('\\')||s.includes(':')||s.split('/').some(p=>!p||p==='.'||p==='..')||/[\u0000-\u001f]/.test(s))fail('Unsafe archive path.');return s;}
/** Validate the entire directory and local headers before starting any decompressor. */
export async function readNativeZip(bytes:Uint8Array,requireMimetype=true){
 boundedBytes(bytes);const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=(p:number)=>v.getUint16(p,true),u32=(p:number)=>v.getUint32(p,true);
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
 if(end<0||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))fail('Invalid or multi-disk ZIP.');
 const count=u16(end+10),size=u32(end+12),start=u32(end+16);if(count<2||count>40||start+size!==end)fail('Archive directory exceeds limits.');
 const entries:{name:string;method:number;crc:number;raw:number;packed:number;offset:number;data:number;end:number}[]=[],names=new Set<string>();let at=start,total=0;
 for(let i=0;i<count;i++){
  if(at+46>end||u32(at)!==0x02014b50)fail('Truncated ZIP directory.');const flags=u16(at+8),method=u16(at+10),crc=u32(at+16),packed=u32(at+20),raw=u32(at+24),nl=u16(at+28),extra=u16(at+30),comment=u16(at+32),offset=u32(at+42),next=at+46+nl+extra+comment;
  if(next>end||flags&~0x808||![0,8].includes(method)||u16(at+34)||raw>MAX_ARCHIVE_EXPANSION||(total+=raw)>MAX_ARCHIVE_EXPANSION)fail('Unsupported ZIP flags, compression or expansion size.');
  const name=safePath(decode.decode(bytes.subarray(at+46,at+46+nl)));if(names.has(name))fail('Duplicate archive entry.');names.add(name);
  if(offset+30>start||u32(offset)!==0x04034b50||u16(offset+6)!==flags||u16(offset+8)!==method)fail('ZIP local header mismatch.');const ln=u16(offset+26),le=u16(offset+28),data=offset+30+ln+le;
  if(data+packed>start||decode.decode(bytes.subarray(offset+30,offset+30+ln))!==name)fail('ZIP local entry mismatch.');
  let finish=data+packed;
  if(flags&8){if(finish+12>start)fail('Truncated ZIP descriptor.');const d=u32(finish)===0x08074b50?finish+4:finish;if(d+12>start||u32(d)!==crc||u32(d+4)!==packed||u32(d+8)!==raw)fail('ZIP descriptor mismatch.');finish=d+12;}
  else if(u32(offset+14)!==crc||u32(offset+18)!==packed||u32(offset+22)!==raw)fail('ZIP sizes mismatch.');
  if(method===0&&raw!==packed)fail('Stored ZIP size mismatch.');entries.push({name,method,crc,raw,packed,offset,data,end:finish});at=next;
 }
 if(at!==end)fail('Invalid ZIP directory length.');const sorted=entries.slice().sort((a,b)=>a.offset-b.offset);let next=0;for(const e of sorted){if(e.offset!==next)fail('Overlapping or extraneous ZIP data.');next=e.end;}if(next!==start)fail('Unexpected ZIP payload.');
 if(requireMimetype&&(sorted[0].name!=='mimetype'||sorted[0].method!==0))fail('OpenRaster mimetype must be first and stored.');
 const files=new Map<string,Uint8Array>();for(const e of entries){const packed=bytes.subarray(e.data,e.data+e.packed);let out:Uint8Array;if(e.method===0)out=packed.slice();else{
   const reader=new Blob([new Uint8Array(packed)]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();out=new Uint8Array(e.raw);let n=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;if(n+value.length>e.raw)fail('ZIP expansion exceeds declared size.');out.set(value,n);n+=value.length;}if(n!==e.raw)fail('Truncated ZIP expansion.');}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  }if(crc32(out)!==e.crc)fail('ZIP checksum mismatch.');files.set(e.name,out);
 }return files;
}
export function writeNativeZip(files:Map<string,Uint8Array>){
 const parts:Uint8Array[]=[],directory:Uint8Array[]=[];let offset=0,total=0;if(files.size>40)fail('Too many archive entries.');
 for(const [path,data]of files){safePath(path);if((total+=data.length)>MAX_ARCHIVE_EXPANSION)fail('Archive exceeds expansion budget.');const name=text.encode(path),crc=crc32(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);
  const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=local.length+data.length;
 }const dir=concat(directory),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.size,true);v.setUint16(10,files.size,true);v.setUint32(12,dir.length,true);v.setUint32(16,offset,true);const out=concat([...parts,dir,end]);if(out.length>MAX_NATIVE_BYTES)fail('Archive exceeds input limit.');return out;
}
