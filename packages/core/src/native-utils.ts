export const MAX_NATIVE_BYTES=16*1024*1024;
export function fail(text:string):never{throw new Error(text);}
export function boundedBytes(bytes:Uint8Array){if(!bytes.length||bytes.length>MAX_NATIVE_BYTES)fail('Native file must be 1 byte to 16 MiB.');}
export function integer(n:unknown,min:number,max:number,label:string):number{if(typeof n!=='number'||!Number.isInteger(n)||n<min||n>max)fail(`${label} must be ${min}-${max} whole units.`);return n;}
export function name(value:unknown,label='Name'):string{if(typeof value!=='string'||!value.trim()||value.length>80)fail(`${label} needs 1-80 characters.`);return value;}
export function concat(parts:Uint8Array[]){const n=parts.reduce((n,p)=>n+p.length,0);if(n>MAX_NATIVE_BYTES)fail('Native output exceeds 16 MiB.');const out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
/** Streaming output cap is checked before retaining each decompressed chunk. */
export async function inflate(bytes:Uint8Array,expected:number){
 if(expected<0||expected>4*1024*1024+8192)fail('Decompressed raster exceeds its budget.');
 const reader=new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),out=new Uint8Array(expected);let at=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(at+value.length>expected)fail('Compressed raster expands beyond its declared dimensions.');out.set(value,at);at+=value.length;}if(at!==expected)fail('Compressed raster is truncated.');return out;}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
export async function deflate(bytes:Uint8Array){return new Uint8Array(await new Response(new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());}
export function base64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function unbase64(s:unknown){if(typeof s!=='string'||s.length>MAX_NATIVE_BYTES*4/3+4||s.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail('Invalid embedded PNG base64.');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
export class Reader{
 at=0;view:DataView;constructor(readonly bytes:Uint8Array){this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
 take(n:number){if(!Number.isInteger(n)||n<0||this.at+n>this.bytes.length)fail('Truncated native structure.');const b=this.bytes.subarray(this.at,this.at+n);this.at+=n;return b;}
 u8(){return this.take(1)[0];}u16(){this.take(2);return this.view.getUint16(this.at-2,true);}i16(){this.take(2);return this.view.getInt16(this.at-2,true);}u32(){this.take(4);return this.view.getUint32(this.at-4,true);}
 text(){return new TextDecoder('utf-8',{fatal:true}).decode(this.take(this.u16()));}
 end(){if(this.at!==this.bytes.length)fail('Unexpected bytes in native structure.');}
}
export class Writer{
 parts:Uint8Array[]=[];u8(n:number){this.parts.push(Uint8Array.of(n));return this;}u16(n:number){const p=new Uint8Array(2);new DataView(p.buffer).setUint16(0,n,true);this.parts.push(p);return this;}u32(n:number){const p=new Uint8Array(4);new DataView(p.buffer).setUint32(0,n,true);this.parts.push(p);return this;}zeros(n:number){this.parts.push(new Uint8Array(n));return this;}bytes(p:Uint8Array){this.parts.push(p);return this;}text(s:string){const p=new TextEncoder().encode(s);return this.u16(p.length).bytes(p);}done(){return concat(this.parts);}
}
