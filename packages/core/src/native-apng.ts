import {animationImport} from './raster-exchange.js';
import {decodeNativePng,pngChunk,crc32} from './native-png.js';
import {boundedBytes,integer,fail,concat} from './native-utils.js';
const signature=Uint8Array.of(137,80,78,71,13,10,26,10);
type Frame={width:number;height:number;x:number;y:number;duration:number;dispose:number;blend:number;idat:boolean;parts:Uint8Array[]};
/** PNG 3 animation; all structure/sequence/resource checks precede any frame inflation. */
export async function decodeApng(input:Uint8Array,title='Imported APNG'){
 boundedBytes(input);const bytes=input.slice();if(!signature.every((n,i)=>bytes[i]===n))fail('APNG needs a PNG signature.');const v=new DataView(bytes.buffer),frames:Frame[]=[],shared:Uint8Array[]=[],fallback:Uint8Array[]=[];let header:Uint8Array|null=null,width=0,height=0,at=8,count=0,declared=0,sequence=0,idat=false,idatClosed=false,ended=false,current:Frame|null=null;const warnings=new Set<string>(['APNG imports composited RGBA frames on one layer. Loop count, original frame rectangles, editable layers, colour/text metadata and project structure are omitted.']);
 while(at+12<=bytes.length){if(++count>4096)fail('APNG exceeds 4096 chunks.');const n=v.getUint32(at),end=at+n+12;if(end>bytes.length)fail('Truncated APNG chunk.');const type=String.fromCharCode(...bytes.subarray(at+4,at+8)),data=bytes.subarray(at+8,end-4),d=new DataView(data.buffer,data.byteOffset,data.byteLength);if(crc32(bytes.subarray(at+4,end-4))!==v.getUint32(end-4))fail('APNG checksum mismatch.');if(count===1&&type!=='IHDR')fail('APNG header must be first.');if(idat&&type!=='IDAT')idatClosed=true;
  if(type==='IHDR'){if(header||count!==1||n!==13)fail('Invalid APNG header.');width=integer(d.getUint32(0),1,256,'APNG width');height=integer(d.getUint32(4),1,256,'APNG height');if(data[8]!==8||![2,3,6].includes(data[9])||data[10]||data[11]||data[12])fail('APNG requires non-interlaced 8-bit RGB/RGBA/indexed pixels.');header=data;}
  else if(type==='acTL'){if(n!==8||declared||idat||!header)fail('Invalid APNG animation control order.');declared=integer(d.getUint32(0),1,32,'APNG frame count');if(width*height*declared*4>4*1024*1024)fail('APNG decoded cels exceed 4 MiB.');}
  else if(type==='fcTL'){if(!declared||n!==26||d.getUint32(0)!==sequence++||current&&!current.parts.length)fail('Invalid APNG frame control sequence/data.');const w=d.getUint32(4),h=d.getUint32(8),x=d.getUint32(12),y=d.getUint32(16),dispose=data[24],blend=data[25];if(!w||!h||x+w>width||y+h>height||dispose>2||blend>1||frames.length>=declared)fail('Invalid APNG frame bounds/control.');if(!idat&&(frames.length||w!==width||h!==height||x||y))fail('APNG default animation frame must cover the canvas.');const raw=d.getUint16(20)*1000/(d.getUint16(22)||100),duration=Math.max(20,Math.min(5000,Math.round(raw)));if(duration!==raw)warnings.add('APNG fractional/out-of-range timing rounded and clamped to 20-5000 whole milliseconds.');current={width:w,height:h,x,y,duration,dispose,blend,idat:!idat,parts:[]};frames.push(current);}
  else if(type==='IDAT'){if(!declared||idatClosed||current&&!current.idat)fail('Invalid APNG IDAT order.');idat=true;if(current)current.parts.push(data);else fallback.push(data);}
  else if(type==='fdAT'){if(!idat||!current||current.idat||n<4||d.getUint32(0)!==sequence++)fail('Invalid APNG frame-data sequence.');current.parts.push(data.subarray(4));}
  else if(type==='IEND'){if(n||!idat||!current?.parts.length||frames.length!==declared||end!==bytes.length)fail('Incomplete APNG ending or frame count.');ended=true;break;}
  else if(['PLTE','tRNS','sRGB'].includes(type)){if(type==='sRGB'&&(n!==1||data[0]>3||shared.some(p=>String.fromCharCode(...p.subarray(4,8))==='sRGB')))fail('Invalid APNG sRGB metadata.');if(idat||frames.some(f=>f.parts.length))fail('APNG global metadata must precede image data.');shared.push(pngChunk(type,data));}
  else if(!['pHYs','tEXt','iTXt','zTXt','tIME','eXIf','bKGD'].includes(type))fail(`Unsupported APNG chunk ${type}; custom profiles/critical extensions are unsupported.`);
  at=end;
 }
 if(!ended||!header||!declared)fail('Incomplete animated PNG; static PNG is not APNG.');
 const decode=(w:number,h:number,parts:Uint8Array[])=>{const ihdr=header!.slice(),view=new DataView(ihdr.buffer);view.setUint32(0,w);view.setUint32(4,h);return decodeNativePng(concat([signature,pngChunk('IHDR',ihdr),...shared,...parts.map(p=>pngChunk('IDAT',p)),pngChunk('IEND',new Uint8Array())]),w,h);};
 if(fallback.length){await decode(width,height,fallback);warnings.add('The default static fallback image is validated but omitted from the animation.');}
 const output:{pixels:Uint8ClampedArray;duration:number}[]=[];let canvas:Uint8ClampedArray=new Uint8ClampedArray(width*height*4);let prior:Frame|null=null,restore:Uint8ClampedArray|null=null;
 for(const f of frames){if(prior){if(prior.dispose===1||prior.dispose===2&&!restore){for(let y=0;y<prior.height;y++)canvas.fill(0,((prior.y+y)*width+prior.x)*4,((prior.y+y)*width+prior.x+prior.width)*4);}else if(prior.dispose===2&&restore)canvas=restore;}
  const source=await decode(f.width,f.height,f.parts);restore=f.dispose===2?canvas.slice():null;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const i=(y*f.width+x)*4,j=((y+f.y)*width+x+f.x)*4;if(!f.blend)canvas.set(source.subarray(i,i+4),j);else{const sa=source[i+3],da=canvas[j+3],den=sa*255+da*(255-sa);if(!den)canvas.fill(0,j,j+4);else{for(let c=0;c<3;c++)canvas[j+c]=Math.round((source[i+c]*sa*255+canvas[j+c]*da*(255-sa))/den);canvas[j+3]=Math.round(den/255);}}}
  output.push({pixels:canvas.slice(),duration:f.duration});prior=f;
 }return animationImport(width,height,output,title,[...warnings],'APNG frames');
}
