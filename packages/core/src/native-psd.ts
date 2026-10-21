import {createDocument,makeLayer,checkCelBudget,composite,type PixelDocument} from './document.js';
import {boundedBytes,concat,fail,integer,name} from './native-utils.js';
import {layerExportSnapshot,type LayerExportMode} from './layer-exchange.js';
import type {NativeImport} from './native-aseprite.js';
class R{
 at=0;v:DataView;constructor(readonly b:Uint8Array){this.v=new DataView(b.buffer,b.byteOffset,b.byteLength);}
 take(n:number){if(!Number.isInteger(n)||n<0||this.at+n>this.b.length)fail('Truncated PSD structure.');const p=this.b.subarray(this.at,this.at+n);this.at+=n;return p;}
 u8(){return this.take(1)[0];}u16(){this.take(2);return this.v.getUint16(this.at-2);}i16(){this.take(2);return this.v.getInt16(this.at-2);}u32(){this.take(4);return this.v.getUint32(this.at-4);}i32(){this.take(4);return this.v.getInt32(this.at-4);}str(n:number){return String.fromCharCode(...this.take(n));}block(){return new R(this.take(this.u32()));}end(){if(this.at!==this.b.length)fail('Unexpected PSD data.');}
}
class W{
 p:Uint8Array[]=[];bytes(b:Uint8Array){this.p.push(b);return this;}str(s:string){return this.bytes(Uint8Array.from(s,c=>c.charCodeAt(0)));}u8(n:number){return this.bytes(Uint8Array.of(n));}u16(n:number){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n);return this.bytes(b);}u32(n:number){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n);return this.bytes(b);}block(b:Uint8Array){return this.u32(b.length).bytes(b);}done(){return concat(this.p);}
}
function plane(r:R,w:number,h:number){const method=r.u16(),out=new Uint8Array(w*h);if(method===0){out.set(r.take(out.length));}else if(method===1){const sizes=Array.from({length:h},()=>r.u16());for(let y=0;y<h;y++){const row=new R(r.take(sizes[y]));let x=0;while(row.at<row.b.length){const n=row.u8();if(n===128)continue;const count=n<128?n+1:257-n;if(x+count>w)fail('PSD RLE row expands beyond dimensions.');if(n<128)out.set(row.take(count),y*w+x);else out.fill(row.u8(),y*w+x,y*w+x+count);x+=count;}if(x!==w)fail('Truncated PSD RLE row.');}}else fail('PSD needs raw or PackBits channels.');r.end();return out;}
export function decodePsd(bytes:Uint8Array,title='Imported PSD'):NativeImport{
 boundedBytes(bytes);const r=new R(bytes);if(r.str(4)!=='8BPS'||r.u16()!==1||r.take(6).some(Boolean))fail('Only PSD version 1 is supported.');const channels=r.u16(),height=integer(r.u32(),1,256,'Height'),width=integer(r.u32(),1,256,'Width');if(![3,4].includes(channels)||r.u16()!==8||r.u16()!==3)fail('PSD needs 8-bit RGB/RGBA.');if(r.block().b.length)fail('Unsupported PSD colour data.');
 const resources=r.block();let metadata=false;while(resources.at<resources.b.length){if(resources.str(4)!=='8BIM')fail('Invalid PSD resource.');const id=resources.u16(),n=resources.u8();resources.take(n);if((n+1)%2)resources.take(1);const data=resources.take(resources.u32());if(data.length%2)resources.take(1);if(![1005,1006,1024,1026,1028,1032,1033,1036,1045,1054,1057,1060,1061,1062,1069,1072].includes(id))fail('Unsupported PSD resource: profiles, animation and unknown features are rejected.');metadata=true;}
 const section=r.block(),info=section.block(),count=Math.abs(info.i16());checkCelBudget(width,height,count,1);const records:{top:number;left:number;w:number;h:number;visible:boolean;opacity:number;name:string;channels:{id:number;size:number}[]}[]=[];
 for(let i=0;i<count;i++){
  const top=info.i32(),left=info.i32(),bottom=info.i32(),right=info.i32(),w=right-left,h=bottom-top;if(top<0||left<0||w<0||h<0||right>width||bottom>height)fail('PSD layer must lie inside canvas.');const nc=info.u16();if(nc<3||nc>4)fail('Unsupported PSD channel count.');const cs=Array.from({length:nc},()=>({id:info.i16(),size:info.u32()}));if(new Set(cs.map(c=>c.id)).size!==nc||![0,1,2].every(id=>cs.some(c=>c.id===id))||cs.some(c=>![-1,0,1,2].includes(c.id)||c.size<2))fail('Unsupported PSD mask/channel.');
  if(info.str(4)!=='8BIM'||info.str(4)!=='norm')fail('PSD blend modes are unsupported.');const opacity=info.u8();if(info.u8()!==0)fail('PSD clipping is unsupported.');const flags=info.u8();if(flags&~10||info.u8())fail('Unsupported PSD layer flags.');const extra=info.block();if(extra.block().b.length||extra.block().b.length)fail('PSD masks and blending ranges are unsupported.');const nl=extra.u8();let label=extra.str(nl);extra.take((4-(nl+1)%4)%4);
  while(extra.at<extra.b.length){if(extra.str(4)!=='8BIM')fail('Unsupported PSD extra signature.');const key=extra.str(4),data=extra.take(extra.u32());if(data.length%2)extra.take(1);if(key==='luni'){const s=new R(data),len=s.u32();if(len>80||len*2>s.b.length-4)fail('PSD layer name too long.');label='';for(let j=0;j<len;j++)label+=String.fromCharCode(s.u16());if(s.b.length-s.at>3||s.take(s.b.length-s.at).some(Boolean))fail('Invalid PSD Unicode padding.');s.end();}else if(['lyid','lclr','lnsr'].includes(key))metadata=true;else fail(`Unsupported PSD layer feature ${key}.`);}
  records.push({top,left,w,h,visible:!(flags&2),opacity,name:name(label||`Layer ${i+1}`),channels:cs});
 }
 const doc=createDocument(width,height,name(title));doc.layers=[];for(const [i,l]of records.entries()){
  const pixels=new Uint8ClampedArray(width*height*4);for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++)pixels[((l.top+y)*width+l.left+x)*4+3]=255;
  for(const c of l.channels){const p=plane(new R(info.take(c.size)),l.w,l.h),channel=c.id===-1?3:c.id;for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++)pixels[((l.top+y)*width+l.left+x)*4+channel]=p[y*l.w+x];}
  doc.layers.push(makeLayer(doc,`layer-${i+1}`,l.name,l.visible,{'frame-1':pixels},{opacity:l.opacity}));
 }if(info.at<info.b.length){if(info.b.length-info.at>3||info.take(info.b.length-info.at).some(Boolean))fail('Unsupported PSD layer tail.');}if(section.at<section.b.length&&section.block().b.length)fail('PSD global mask is unsupported.');section.end();
 // Validate the composite stream as well; it is not the authoritative editable content.
 const method=r.u16();if(method===0)r.take(width*height*channels);else if(method===1){const sizes=Array.from({length:height*channels},()=>r.u16());for(let c=0;c<channels;c++){const lengths=sizes.slice(c*height,(c+1)*height),table=new W().u16(1);for(const n of lengths)table.u16(n);plane(new R(table.bytes(r.take(lengths.reduce((a,b)=>a+b,0))).done()),width,height);}}else fail('Unsupported PSD composite compression.');r.end();doc.activeLayerId=doc.layers.at(-1)!.id;
 return {document:doc,warnings:['PSD imports a static layered image; palette swatches, timing and conversion sources are not retained.',...(metadata?['Non-rendering PSD metadata is omitted.']:[])]};
}
export function encodePsd(source:PixelDocument,mode:LayerExportMode='selected-frame'){
 const {document:doc,warnings}=layerExportSnapshot(source,mode),records=new W(),data=new W(),size=doc.width*doc.height;
 for(const l of doc.layers){
  records.u32(0).u32(0).u32(doc.height).u32(doc.width).u16(4);for(const id of [0,1,2,-1])records.u16(id).u32(size+2);records.str('8BIMnorm').u8(l.opacity).u8(0).u8(l.visible?8:10).u8(0);
  const ascii=l.name.replace(/[^\x20-\x7e]/g,'?'),pascal=new W().u8(ascii.length).str(ascii).bytes(new Uint8Array((4-(ascii.length+1)%4)%4)).done(),unicode=new W().u32(l.name.length);for(let i=0;i<l.name.length;i++)unicode.u16(l.name.charCodeAt(i));const u=unicode.done();records.block(new W().u32(0).u32(0).bytes(pascal).str('8BIMluni').block(u).done());
  for(let c=0;c<4;c++){const p=new Uint8Array(size);for(let i=0;i<size;i++)p[i]=l.pixels[i*4+c];data.u16(0).bytes(p);}
 }
 let info=new W().u16(-doc.layers.length).bytes(records.done()).bytes(data.done()).done();if(info.length%2)info=concat([info,Uint8Array.of(0)]);const section=new W().block(info).u32(0).done(),merged=composite(doc),image=new W().u16(0);for(let c=0;c<4;c++){const p=new Uint8Array(size);for(let i=0;i<size;i++){const alpha=merged[i*4+3];p[i]=c<3&&alpha>0&&alpha<255?Math.round(merged[i*4+c]*alpha/255+255-alpha):merged[i*4+c];}image.bytes(p);}
 if(merged.some((v,i)=>i%4===3&&v>0&&v<255))warnings.push('PSD merged previews use white-matted 8-bit transparency; preview colours can round. Editable layer RGBA bytes stay exact.');
 const bytes=new W().str('8BPS').u16(1).bytes(new Uint8Array(6)).u16(4).u32(doc.height).u32(doc.width).u16(8).u16(3).u32(0).u32(0).block(section).bytes(image.done()).done();return {bytes,warnings};
}
