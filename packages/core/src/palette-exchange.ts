import {validatePalette,decodePalette,encodePalette,MAX_PALETTE_BYTES} from './toolkit.js';
export const PALETTE_FORMATS={ezpalette:'EzPix JSON',gpl:'GIMP GPL',jasc:'JASC PAL',riff:'RIFF PAL',act:'Adobe ACT',aco:'Adobe ACO (RGB)',ase:'Adobe ASE (RGB)',hex:'Hex text'} as const;
export type PaletteFormat=keyof typeof PALETTE_FORMATS;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
function fail(message:string):never{throw new Error(message);}
function count(n:number){if(!Number.isInteger(n)||n<1||n>256)fail('Palette requires 1-256 colours.');return n;}
const hex=(rgb:number[])=>'#'+rgb.map(n=>{if(!Number.isInteger(n)||n<0||n>255)fail('Palette RGB channels must be 0-255.');return n.toString(16).padStart(2,'0');}).join('');
class Reader{
 at=0;v:DataView;constructor(readonly bytes:Uint8Array){this.v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
 take(n:number){if(!Number.isInteger(n)||n<0||this.at+n>this.bytes.length)fail('Truncated palette structure.');const b=this.bytes.subarray(this.at,this.at+n);this.at+=n;return b;}
 u16(le=false){this.take(2);return this.v.getUint16(this.at-2,le);}u32(le=false){this.take(4);return this.v.getUint32(this.at-4,le);}float(){this.take(4);return this.v.getFloat32(this.at-4);}ascii(n:number){return String.fromCharCode(...this.take(n));}end(){if(this.at!==this.bytes.length)fail('Unexpected palette data.');}
 unicode(length:number){if(length<1||length>81)fail('Palette names are limited to 80 characters.');let s='';for(let i=0;i<length;i++){const n=this.u16();if(i===length-1){if(n!==0)fail('Palette Unicode name needs a terminator.');}else {if(!n)fail('Invalid palette Unicode name.');s+=String.fromCharCode(n);}}return s;}
}
class Writer{
 values:number[]=[];u16(n:number,le=false){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,le);return this.bytes(b);}u32(n:number,le=false){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,le);return this.bytes(b);}float(n:number){const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,n);return this.bytes(b);}ascii(s:string){return this.bytes(enc.encode(s));}bytes(b:Uint8Array){this.values.push(...b);return this;}unicode(s:string){this.u16(s.length+1);for(const c of s)this.u16(c.charCodeAt(0));return this.u16(0);}done(){const b=Uint8Array.from(this.values);if(b.length>MAX_PALETTE_BYTES)fail('Palette exceeds 16 KiB.');return b;}
}
export interface PaletteImport {format:PaletteFormat;colors:string[];warnings:string[]}
export function decodePaletteFile(bytes:Uint8Array,filename:string):PaletteImport{
 if(!bytes.length||bytes.length>MAX_PALETTE_BYTES)fail('Palette must be 1 byte to 16 KiB.');const ext=filename.toLowerCase().split('.').at(-1),warnings=new Set<string>(),colors:string[]=[];let format:PaletteFormat;
 const add=(rgb:number[])=>{if(colors.length>=256)fail('Palette exceeds 256 entries.');colors.push(hex(rgb));},precision=(v:number)=>{if(!Number.isFinite(v)||v<0||v>1)fail('Invalid RGB swatch component.');const n=v*255;if(Math.abs(n-Math.round(n))>0.00002)warnings.add('Colour precision is rounded to 8-bit RGB.');return Math.round(n);};
 if(['ezpalette','json','gpl','hex','txt'].includes(ext??'')||ext==='pal'&&String.fromCharCode(...bytes.subarray(0,8))==='JASC-PAL'){
  const text=dec.decode(bytes).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),lines=text.split('\n');
  if(ext==='ezpalette'||ext==='json'){format='ezpalette';colors.push(...decodePalette(text));if(JSON.parse(text).colors.length!==colors.length)warnings.add('Duplicate RGB colours are removed, keeping their first occurrence.');}
  else if(ext==='gpl'){
   format='gpl';if(lines.shift()!=='GIMP Palette')fail('Expected GIMP Palette header.');let entries=false;for(const line of lines){if(!line.trim()||/^\s*#/.test(line))continue;if(!entries&&/^(Name|Columns):/.test(line)){warnings.add('Palette names, swatch names and layout metadata are not stored.');if(line.startsWith('Columns:')&&!/^Columns:\s*\d+\s*$/.test(line))fail('Invalid GPL column count.');continue;}entries=true;const m=/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(line);if(!m)fail('Invalid GPL RGB entry.');add(m.slice(1,4).map(Number));if(m[4]?.trim())warnings.add('Palette names, swatch names and layout metadata are not stored.');}
  }else if(ext==='pal'){
   format='jasc';if(lines.shift()!=='JASC-PAL'||lines.shift()!=='0100')fail('Expected JASC-PAL 0100 header.');const raw=lines.shift();if(!raw||!/^\d+$/.test(raw))fail('Invalid JASC colour count.');const n=count(Number(raw)),entries=lines.filter(l=>l.trim());if(entries.length!==n)fail('JASC colour count does not match entries.');for(const line of entries){if(!/^\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*$/.test(line))fail('Invalid JASC RGB entry.');add(line.trim().split(/\s+/).map(Number));}
  }else{
   format='hex';for(const line of lines){if(!line.trim()||/^\s*(;|\/\/)/.test(line))continue;const h=line.trim();if(!/^#?[\da-fA-F]{6}$/.test(h))fail('Hex palettes need one six-digit RGB colour per line.');colors.push('#'+h.replace('#','').toLowerCase());if(colors.length>256)fail('Palette exceeds 256 entries.');}
  }
 }else if(ext==='act'){
  format='act';if(![768,772].includes(bytes.length))fail('ACT needs 768 or 772 bytes.');const r=new Reader(bytes);let n=256;if(bytes.length===772){const tail=new DataView(bytes.buffer,bytes.byteOffset+768,4);n=count(tail.getUint16(0)||256);if(tail.getUint16(2)!==65535)fail('ACT transparency cannot be represented by RGB palette swatches.');}for(let i=0;i<n;i++)add([...r.take(3)]);
 }else if(ext==='pal'){
  format='riff';const r=new Reader(bytes);if(r.ascii(4)!=='RIFF'||r.u32(true)!==bytes.length-8||r.ascii(4)!=='PAL ')fail('Expected RIFF PAL container.');let found=false,chunks=0;while(r.at<bytes.length){if(++chunks>32)fail('Too many RIFF chunks.');const type=r.ascii(4),n=r.u32(true),data=r.take(n);if(n%2)r.take(1);if(type!=='data'||found)fail('Unsupported or repeated RIFF palette chunk.');found=true;const p=new Reader(data);if(p.u16(true)!==0x0300)fail('Unsupported RIFF palette version.');const entries=count(p.u16(true));for(let i=0;i<entries;i++){add([...p.take(3)]);if(p.take(1)[0])fail('RIFF palette flags are unsupported.');}p.end();}if(!found)fail('Missing RIFF palette data.');
 }else if(ext==='aco'){
  format='aco';const r=new Reader(bytes);let previous:string[]|undefined,firstVersion=0;for(let section=0;section<2&&r.at<bytes.length;section++){const version=r.u16();if(!section)firstVersion=version;if(![1,2].includes(version)||section===1&&(version!==2||firstVersion!==1))fail('Unsupported ACO section version.');const n=count(r.u16()),entries:string[]=[];for(let i=0;i<n;i++){if(r.u16()!==0)fail('Only RGB ACO swatches are supported.');const rgb=[r.u16(),r.u16(),r.u16()];if(r.u16())fail('Unsupported ACO reserved channel.');entries.push(hex(rgb.map(v=>precision(v/65535))));if(version===2){const name=r.unicode(r.u32());if(name)warnings.add('Swatch names are not stored.');}}if(previous&&previous.join()!==entries.join())fail('ACO v1 and v2 colour sections disagree.');previous=entries;}r.end();if(previous)colors.push(...previous);
 }else if(ext==='ase'){
  format='ase';const r=new Reader(bytes);if(r.ascii(4)!=='ASEF'||r.u16()!==1||r.u16()!==0)fail('Expected Adobe ASE swatches, not an Aseprite project.');const blocks=r.u32();if(!blocks||blocks>1024)fail('ASE exceeds block budget.');let depth=0;for(let i=0;i<blocks;i++){const type=r.u16(),p=new Reader(r.take(r.u32()));if(type===0xc001){p.unicode(p.u16());if(++depth>4)fail('ASE groups exceed four levels.');warnings.add('Palette groups and names are flattened to ordered RGB swatches.');}else if(type===0xc002){if(p.bytes.length||--depth<0)fail('Invalid ASE group ending.');}else if(type===1){const label=p.unicode(p.u16());if(label)warnings.add('Swatch names are not stored.');if(p.ascii(4)!=='RGB ')fail('Only RGB ASE swatches are supported.');add([precision(p.float()),precision(p.float()),precision(p.float())]);if(p.u16()!==2)fail('Spot/global ASE swatches are unsupported; use normal RGB swatches.');}else fail('Unsupported ASE block.');p.end();}r.end();if(depth)fail('Unclosed ASE group.');
 }else fail('Choose EzPix, GPL, JASC/RIFF PAL, ACT, ACO, Adobe ASE or hex text.');
 count(colors.length);const unique=validatePalette(colors);if(unique.length!==colors.length)warnings.add('Duplicate RGB colours are removed, keeping their first occurrence.');return {format,colors:unique,warnings:[...warnings]};
}
export function encodePaletteFile(input:readonly string[],format:PaletteFormat){
 const colors=validatePalette(input),rgb=colors.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));let bytes:Uint8Array,ext:string=format;const warnings=['RGB swatches only: swatch names, groups, alpha and colour profiles are not stored in EzPix palettes.'];
 if(format==='ezpalette'){bytes=enc.encode(encodePalette(colors));warnings.length=0;}
 else if(format==='gpl')bytes=enc.encode('GIMP Palette\nName: EzPix\nColumns: 0\n#\n'+rgb.map((r,i)=>r.join(' ')+'\t'+colors[i]).join('\n')+'\n');
 else if(format==='jasc'){ext='pal';bytes=enc.encode('JASC-PAL\r\n0100\r\n'+colors.length+'\r\n'+rgb.map(r=>r.join(' ')).join('\r\n')+'\r\n');}
 else if(format==='riff'){ext='pal';const data=new Writer().u16(0x0300,true).u16(colors.length,true);for(const r of rgb)data.bytes(Uint8Array.of(...r,0));const p=data.done();bytes=new Writer().ascii('RIFF').u32(p.length+12,true).ascii('PAL data').u32(p.length,true).bytes(p).done();}
 else if(format==='hex')bytes=enc.encode(colors.join('\n')+'\n');
 else if(format==='act'){bytes=new Uint8Array(772);for(let i=0;i<rgb.length;i++)bytes.set(rgb[i],i*3);const v=new DataView(bytes.buffer);v.setUint16(768,colors.length);v.setUint16(770,65535);}
 else if(format==='aco'){const w=new Writer().u16(1).u16(colors.length);for(const r of rgb){w.u16(0);for(const c of r)w.u16(c*257);w.u16(0);}w.u16(2).u16(colors.length);for(let i=0;i<rgb.length;i++){w.u16(0);for(const c of rgb[i])w.u16(c*257);w.u16(0).u32(colors[i].length+1);for(const c of colors[i])w.u16(c.charCodeAt(0));w.u16(0);}bytes=w.done();}
 else if(format==='ase'){const w=new Writer().ascii('ASEF').u16(1).u16(0).u32(colors.length);for(let i=0;i<rgb.length;i++){const p=new Writer().unicode(colors[i]).ascii('RGB ');for(const c of rgb[i])p.float(c/255);const b=p.u16(2).done();w.u16(1).u32(b.length).bytes(b);}bytes=w.done();}
 else return fail('Unsupported palette export format.');
 if(bytes.length>MAX_PALETTE_BYTES)fail('Palette exceeds 16 KiB.');return {bytes,filename:`palette-${format}.${ext}`,mime:['ezpalette'].includes(format)?'application/json':['gpl','jasc','hex'].includes(format)?'text/plain':'application/octet-stream',warnings};
}
