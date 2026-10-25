import {createDocument,composite,checkCelBudget,makeLayer,validateDuration,decodeProject,encodeProject,type PixelDocument} from './document.js';
import {refreshIndexedCaches,validateIndexedDocument} from './indexed-document.js';
import {validateTags,type PlaybackMode} from './animation.js';
import {nativeMetadataWarnings,validateSlices} from './authored-metadata.js';
import {hexColor} from './color.js';
import {Reader,Writer,boundedBytes,fail,inflate,integer,name,concat} from './native-utils.js';
export type AsepriteImportMode='preserve'|'rendered-rgba';
export interface NativeImport {document:PixelDocument;warnings:string[]}
type Chunk={type:number;data:Uint8Array};
type Image={opacity:number;z:number;x:number;y:number;width:number;height:number;data:Uint8Array;plane?:Uint8Array;pixels:Uint8ClampedArray};
const rgb=(p:readonly number[])=>'#'+p.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
const chunk=(type:number,data:Uint8Array)=>new Writer().u32(data.length+6).u16(type).bytes(data).done();
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Strict editable exchange, or explicitly reviewed visible-frame RGBA rendering. */
export async function decodeAseprite(input:Uint8Array,title='Imported Aseprite',mode:AsepriteImportMode='preserve'):Promise<NativeImport>{
 if(!['preserve','rendered-rgba'].includes(mode))fail('Choose preserve or rendered-rgba Aseprite import.');const rendered=mode==='rendered-rgba';
 boundedBytes(input);const bytes=new Uint8Array(input),r=new Reader(bytes);
 if(r.u32()!==bytes.length||r.u16()!==0xa5e0)fail('Invalid Aseprite header or file size.');
 const frames=integer(r.u16(),1,32,'Frames'),width=integer(r.u16(),1,256,'Width'),height=integer(r.u16(),1,256,'Height'),depth=r.u16();
 if(depth!==8&&depth!==32&&!(rendered&&depth===16))fail('Only indexed (8-bit) and RGBA (32-bit) Aseprite files are supported. Grayscale requires conversion first.');
 const flags=r.u32(),speed=r.u16();if(flags&~7)fail('Unknown Aseprite header flags.');r.take(8);
 const transparent=r.u8();r.take(3);const colorCount=r.u16()||256,ratioX=r.u8(),ratioY=r.u8();
 if(ratioX&&ratioY&&ratioX!==ratioY)fail('Non-square Aseprite pixel ratios are not supported.');r.take(92);
 const warnings=new Set<string>();if(rendered)warnings.add('Rendered RGBA import flattens visible layers and bakes cel opacity, z-order, positions and per-frame palettes. Hidden layers, edit locks, cel links, indexed slot identity and transparent hidden RGB are not retained. Keep the original native file for editing.');if(depth===16)warnings.add('Grayscale value/alpha pixels expand to RGBA; gray-channel storage and profiles are not retained.');
 const chunks:Chunk[][]=[],durations:number[]=[];let total=0;
 for(let f=0;f<frames;f++){
  const start=r.at,n=r.u32();if(n<16||start+n>bytes.length)fail('Invalid Aseprite frame size.');
  const fr=new Reader(bytes.subarray(start+4,start+n));if(fr.u16()!==0xf1fa)fail('Invalid Aseprite frame magic.');
  const old=fr.u16(),duration=fr.u16()||speed;validateDuration(duration);durations.push(duration);fr.take(2);
  const count=fr.u32()||old;if(count>8192||total+count>8192)fail('Too many Aseprite chunks.');total+=count;
  const list:Chunk[]=[];for(let i=0;i<count;i++){const size=fr.u32(),type=fr.u16();if(size<6)fail('Invalid Aseprite chunk size.');list.push({type,data:fr.take(size-6)});}fr.end();chunks.push(list);r.at=start+n;
 }r.end();
 const layers:{name:string;visible:boolean;locked:boolean;opacity:number;background:boolean}[]=[];
 for(const [frame,list]of chunks.entries())for(const c of list)if(c.type===0x2004){
  if(frame)fail('Changing Aseprite layer definitions between frames is not supported.');
  const b=new Reader(c.data),lf=b.u16(),type=b.u16(),level=b.u16();b.take(4);const blend=b.u16(),opacity=b.u8();b.take(3);const label=name(b.text(),'Layer name');
  if(type!==0||level||lf&64)fail('Aseprite groups, reference layers and tilemaps are not supported.');
  if(blend)fail('Aseprite layer blend modes are not supported.');if(lf&~127)fail('Unknown Aseprite layer flags.');
  if(flags&4){b.take(16);warnings.add('Layer UUIDs are not retained.');}b.end();
  if(lf&52)warnings.add('Layer movement locks, collapsed and prefer-link flags are not retained.');
  if(depth===32&&lf&8)warnings.add('RGBA background-layer role is omitted; stored pixels are preserved.');
  layers.push({name:label,visible:!!(lf&1),locked:!(lf&2),opacity:flags&1?opacity:255,background:!!(lf&8)});
  if(layers.length>16)fail('Aseprite exceeds 16 layers.');
 }
 checkCelBudget(width,height,layers.length,frames);
 // A background layer treats the transparent index as opaque. Mixing those roles
 // cannot be represented by EzPix's single document-wide slot table.
 const opaque=depth===8&&layers.every(l=>l.background);
 if(!rendered&&depth===8&&layers.some(l=>l.background)&&(!opaque||layers.length!==1))fail('Indexed background files require one opaque background layer; mixed transparency roles need RGBA conversion.');
 const doc=createDocument(width,height,name(title));doc.frames=durations.map((duration,i)=>({id:`frame-${i+1}`,duration}));
 doc.layers=layers.map((l,i)=>makeLayer(doc,`layer-${i+1}`,l.name,l.visible,Object.fromEntries(doc.frames.map(f=>[f.id,new Uint8ClampedArray(0)])),l));doc.activeLayerId=doc.layers.at(-1)!.id;
 const modern=chunks.some(list=>list.some(c=>c.type===0x2019));let palette:number[][]|undefined,firstPalette:number[][]|undefined;
 const palettes:(number[][]|undefined)[]=[];
 for(const [frame,list]of chunks.entries()){
  for(const c of list)if(c.type===0x2019||!modern&&[4,17].includes(c.type)){
   const b=new Reader(c.data);let colors:number[][];
   if(c.type===0x2019){
    const size=integer(b.u32(),1,256,'Palette size'),first=b.u32(),last=b.u32();b.take(8);
    if(first>last||last>=size)fail('Invalid Aseprite palette range.');
    if(!palette&&(first!==0||last!==size-1))fail('The initial Aseprite palette must define every slot.');
    if(palette&&size!==palette.length&&(!rendered||first!==0||last!==size-1))fail('Changing Aseprite palette size requires a full-table rendered RGBA import.');
    colors=palette&&palette.length===size?palette.map(p=>[...p]):Array.from({length:size},()=>[0,0,0,255]);
    for(let i=first;i<=last;i++){const entryFlags=b.u16();if(entryFlags&~1)fail('Unknown palette entry flags.');colors[i]=[b.u8(),b.u8(),b.u8(),b.u8()];if(entryFlags&1){b.text();warnings.add('Palette colour names are not retained.');}}
   }else{
    const size=integer(colorCount,1,256,'Legacy palette size'),count=integer(b.u16(),1,256,'Palette packets');
    colors=palette&&palette.length===size?palette.map(p=>[...p]):Array.from({length:size},()=>[0,0,0,255]);const defined=new Set<number>();let index=0;
    for(let packet=0;packet<count;packet++){index+=b.u8();const count=b.u8()||256;if(index+count>size)fail('Palette packet exceeds declared colours.');
     for(let i=0;i<count;i++){const p=[b.u8(),b.u8(),b.u8()];if(c.type===17&&p.some(v=>v>63))fail('Invalid 6-bit palette.');defined.add(index);colors[index++]=[...p.map(v=>c.type===17?Math.round(v*255/63):v),255];}}
    if(!palette&&defined.size!==size)fail('The initial legacy palette must define every slot.');
   }b.end();palette=colors;
  }
  if(depth===8){
   if(!palette)fail('Indexed Aseprite needs an explicit palette before its first frame.');
   const table=palette.map(p=>[...p]);
   if(!rendered&&!opaque){if(transparent>=table.length)fail('Transparent index exceeds the Aseprite palette.');if(table[transparent][3]!==0)warnings.add('Header transparent slot alpha is set to zero; hidden RGB and index identity are retained.');table[transparent][3]=0;}
   else if(!rendered&&table.some(p=>p[3]!==255))fail('Indexed background palettes must be fully opaque.');
   if(!rendered&&table.some((p,i)=>p[3]===0&&(opaque||i!==transparent)))fail('Indexed Aseprite has additional zero-alpha slots; use RGBA conversion.');
   if(!firstPalette)firstPalette=table;else if(!same(firstPalette,table)){if(!rendered)fail('Frame-varying indexed palettes cannot preserve a single editable slot table.');warnings.add('Frame-varying indexed palettes are baked to RGBA; only first-frame swatches remain.');}
   palettes[frame]=table;
  }else if(palette){if(!firstPalette)firstPalette=palette;else if(!same(firstPalette,palette))warnings.add('Only the first palette is retained; frame-varying swatches are not supported.');}
 }
 if(firstPalette){doc.palette=firstPalette.map(rgb);if(depth===32&&firstPalette.some(p=>p[3]!==255))warnings.add('Palette alpha is reduced to RGB swatches; cel RGBA is preserved.');}
 if(depth===8&&!rendered)doc.indexed={palette:firstPalette!,transparentIndex:opaque?null:transparent,cels:Object.fromEntries(doc.layers.map(l=>[l.id,{}]))};
 const images:Map<number,Image>[]=[];let decodedBytes=0;
 for(const [frame,list]of chunks.entries()){
  const seen=new Map<number,Image>();images.push(seen);
  for(const c of list){const b=new Reader(c.data);
   if(c.type===0x2005){
    const layer=b.u16(),x=b.i16(),y=b.i16(),opacity=b.u8(),type=b.u16(),z=b.i16();b.take(5);
    if(layer>=layers.length||seen.has(layer))fail('Invalid or duplicate Aseprite cel layer.');
    if(!rendered&&(opacity!==255||z))fail('Aseprite cel opacity and z-index offsets are not supported.');
    let data:Uint8Array,w:number,h:number,linked:Image|undefined;
    if(type===1){const target=b.u16();b.end();if(target>=frame)fail('Linked Aseprite cels must target an earlier frame.');linked=images[target].get(layer);if(!linked)fail('Linked Aseprite source cel is missing.');data=linked.data;w=linked.width;h=linked.height;}
    else if(type===0||type===2){w=b.u16();h=b.u16();if(!w||!h||w>(rendered?256:width)||h>(rendered?256:height))fail('Aseprite cel bounds must fit inside its canvas.');const length=w*h*(depth===8?1:depth===16?2:4);decodedBytes+=length;if(decodedBytes>4*1024*1024)fail('Aseprite decoded cel data exceeds 4 MiB.');data=type===0?b.take(length):await inflate(b.take(b.bytes.length-b.at),length);b.end();}
    else fail('Aseprite tilemap cels are not supported.');
    if(!rendered&&(x<0||y<0||x+w>width||y+h>height))fail('Aseprite cel bounds must fit inside its canvas.');
    if(!rendered&&opaque&&(x||y||w!==width||h!==height))fail('Opaque indexed background cels must cover the canvas.');
    const image:Image={opacity,z,x,y,width:w,height:h,data,pixels:new Uint8ClampedArray(0)};
    if(!rendered&&linked&&linked.x===x&&linked.y===y){image.pixels=linked.pixels;image.plane=linked.plane;}
    else{
     if(!rendered&&linked)warnings.add('Linked cels with different positions become independent full-canvas cels.');
     if(rendered){
      const table=palettes[frame];if(depth===8&&data.some(i=>i>=table!.length))fail('Aseprite pixel index exceeds palette slots.');
      if(depth===8&&!layers[layer].background&&transparent>=table!.length)fail('Transparent index exceeds the Aseprite palette.');
      image.pixels=new Uint8ClampedArray(width*height*4);
      for(let row=0;row<h;row++)for(let col=0;col<w;col++){const dx=x+col,dy=y+row;if(dx<0||dy<0||dx>=width||dy>=height)continue;const i=row*w+col,d=(dy*width+dx)*4;
       if(depth===8){const slot=data[i],p=table![slot];image.pixels.set([p[0],p[1],p[2],!layers[layer].background&&slot===transparent?0:p[3]],d);}
       else if(depth===16){const value=data[i*2];image.pixels.set([value,value,value,data[i*2+1]],d);}
       else image.pixels.set(data.subarray(i*4,i*4+4),d);
      }
      if(x<0||y<0||x+w>width||y+h>height)warnings.add('Off-canvas cel pixels are clipped to the declared canvas.');
     }
     else if(depth===8){if(data.some(i=>i>=palettes[frame]!.length))fail('Aseprite pixel index exceeds palette slots.');const plane=new Uint8Array(width*height).fill(opaque?0:transparent);for(let row=0;row<h;row++)plane.set(data.subarray(row*w,(row+1)*w),(row+y)*width+x);image.plane=plane;}
     else{image.pixels=new Uint8ClampedArray(width*height*4);for(let row=0;row<h;row++)image.pixels.set(data.subarray(row*w*4,(row+1)*w*4),((row+y)*width+x)*4);}
    }
    seen.set(layer,image);doc.layers[layer].cels[doc.frames[frame].id]=image.pixels;if(doc.indexed)doc.indexed.cels[doc.layers[layer].id][doc.frames[frame].id]=image.plane!;
   }else if(c.type===0x2007){const profile=b.u16(),pf=b.u16();b.u32();b.take(8);if(profile>1||pf)fail('Custom ICC/gamma Aseprite colour profiles are not supported.');b.end();}
   else if(c.type===0x2018){
    if(frame||doc.tags.length)fail('Changing or repeated Aseprite tag definitions are not supported.');const count=integer(b.u16(),0,16,'Tags');b.take(8);
    for(let i=0;i<count;i++){const from=b.u16(),to=b.u16(),direction=b.u8(),repeat=b.u16();b.take(6);const color=b.take(3);b.take(1);const label=name(b.text(),'Tag name');let mode:PlaybackMode;
     if(direction===0&&(repeat===0||repeat===1))mode=repeat?'once':'loop';else if(direction===1&&repeat===0)mode='reverse';else if(direction===2&&repeat===0)mode='ping-pong';else fail('Aseprite tag direction/repeat cannot be represented exactly.');
     if(color.some(n=>n!==0))warnings.add('Tag display colours are omitted.');doc.tags.push({id:`tag-${doc.tags.length+1}`,name:label,from,to,mode});
    }b.end();validateTags(doc);
   }else if(c.type===0x2022){
    if(frame)fail('Frame-varying Aseprite slices are not supported.');const count=b.u32(),sf=b.u32();b.take(4);const label=name(b.text(),'Slice name');
    if(count!==1||sf&~2)fail('Only one static slice key without nine-patch data is supported.');if(b.u32()!==0)fail('Static Aseprite slices must begin at frame zero.');
    const x=b.i32(),y=b.i32(),w=b.u32(),h=b.u32(),pivotX=sf&2?b.i32():0,pivotY=sf&2?b.i32():0;b.end();
    doc.slices??=[];doc.slices.push({id:`slice-${doc.slices.length+1}`,name:label,x,y,width:w,height:h,pivotX,pivotY});validateSlices(doc.slices,width,height);
   }else if(![0x2004,0x2019,4,17].includes(c.type)){
    if(![0x2016,0x2017,0x2020].includes(c.type))fail('External files, tilesets and precise cel transforms are not supported.');warnings.add(`Aseprite metadata chunk 0x${c.type.toString(16)} is not retained (masks/paths/user data).`);
   }
  }
  if(doc.indexed)for(const [i,l]of doc.layers.entries())if(!seen.has(i)){if(opaque)fail('Opaque indexed background frames require a cel.');doc.indexed.cels[l.id][doc.frames[frame].id]=new Uint8Array(width*height).fill(transparent);}
 }
 if(rendered){
  const cels:Record<string,Uint8ClampedArray>={};
  for(const [frame,seen]of images.entries()){
   const order=[...seen.entries()].sort(([a,ca],[b,cb])=>a+ca.z-b-cb.z||ca.z-cb.z);
   const renderDoc={...doc,layers:order.map(([i,image])=>makeLayer(doc,`render-${i}`,layers[i].name,layers[i].visible,{[doc.frames[frame].id]:image.pixels},{opacity:Math.floor((layers[i].opacity*image.opacity+127)/255)}))};
   cels[doc.frames[frame].id]=composite(renderDoc,doc.frames[frame].id);
  }
  doc.layers=[makeLayer(doc,'layer-1','Rendered native frames',true,cels)];doc.activeLayerId='layer-1';
 }
 if(doc.indexed){refreshIndexedCaches(doc);validateIndexedDocument(doc);}return {document:doc,warnings:[...warnings]};
}
/** Review only actual losses; supported native slots, links, tags, slices and locks survive. */
export function asepriteExportWarnings(doc:PixelDocument){
 const warnings=nativeMetadataWarnings({...doc,indexed:undefined,slices:undefined});
 if(doc.indexed&&!same(doc.palette,doc.indexed.palette.map(rgb)))warnings.push('The Aseprite palette stores indexed RGBA slots; separate EzPix project swatches are omitted.');
 if(doc.references.length)warnings.push('Reference images are omitted in Aseprite.');
 if(doc.conversion)warnings.push('Conversion source and recipe are not included in Aseprite.');
 return warnings;
}
export function encodeAseprite(source:PixelDocument){
 if(source.outputMode||source.editingMode)fail('Document output requires PNG or flattened PSD/ORA export. Use EzPix to preserve source colours.');
 if(source.layers.some(l=>l.text||l.adjustment||l.mask||l.effects?.length))fail('Layer masks/live effects require baking or flattened export. Use EzPix to preserve editability.');
 if(source.layers.some(l=>l.blendMode!=='normal'))fail('Layer blends are unsupported by this native codec. Use EzPix, PNG or flattened PSD/ORA frames.');
 if(source.groups.length)fail('Layer groups are unsupported by this native codec. Use EzPix, PNG or flattened PSD/ORA frames.');
 const doc=decodeProject(encodeProject(source,false)),frames:Uint8Array[]=[],indexed=doc.indexed,opaque=!!indexed&&indexed.transparentIndex===null;
 if(opaque&&(doc.layers.length!==1||indexed!.palette.some(p=>p[3]!==255)))fail('Opaque indexed Aseprite export requires one fully opaque background layer. Use EzPix for multiple opaque layers or partial alpha.');
 const palette=indexed?indexed.palette:doc.palette.map(c=>Array.from(hexColor(c)));
 const links=doc.layers.map(()=>new Map<Uint8Array|Uint8ClampedArray,number>());
 for(const [f,frame]of doc.frames.entries()){
  const parts:Uint8Array[]=[];
  if(!f){
   for(const l of doc.layers)parts.push(chunk(0x2004,new Writer().u16((l.visible?1:0)|(l.locked?0:2)|(opaque?8:0)).u16(0).u16(0).zeros(4).u16(0).u8(l.opacity).zeros(3).text(l.name).done()));
   const p=new Writer().u32(palette.length).u32(0).u32(palette.length-1).zeros(8);for(const c of palette)p.u16(0).bytes(Uint8Array.from(c));parts.push(chunk(0x2019,p.done()));
   if(doc.tags.length){const t=new Writer().u16(doc.tags.length).zeros(8);for(const tag of doc.tags)t.u16(tag.from).u16(tag.to).u8(tag.mode==='reverse'?1:tag.mode==='ping-pong'?2:0).u16(tag.mode==='once'?1:0).zeros(10).text(tag.name);parts.push(chunk(0x2018,t.done()));}
   for(const s of doc.slices??[])parts.push(chunk(0x2022,new Writer().u32(1).u32(2).u32(0).text(s.name).u32(0).u32(s.x).u32(s.y).u32(s.width).u32(s.height).u32(s.pivotX).u32(s.pivotY).done()));
  }
  for(const [i,l]of doc.layers.entries()){
   const data=indexed?indexed.cels[l.id][frame.id]:l.cels[frame.id],prior=links[i].get(data);
   // Write explicit blank images too, so links between empty cels remain real links.
   const cel=new Writer().u16(i).u16(0).u16(0).u8(255).u16(prior===undefined?0:1).u16(0).zeros(5);
   if(prior!==undefined)cel.u16(prior);else{links[i].set(data,f);cel.u16(doc.width).u16(doc.height).bytes(data.length?new Uint8Array(data):new Uint8Array(doc.width*doc.height*4));}
   parts.push(chunk(0x2005,cel.done()));
  }
  const body=concat(parts);frames.push(new Writer().u32(body.length+16).u16(0xf1fa).u16(parts.length).u16(frame.duration).u16(0).u32(parts.length).bytes(body).done());
 }
 const body=concat(frames),header=new Writer().u32(body.length+128).u16(0xa5e0).u16(doc.frames.length).u16(doc.width).u16(doc.height).u16(indexed?8:32).u32(1).u16(doc.frames[0].duration).zeros(8).u8(indexed?.transparentIndex??0).zeros(3).u16(palette.length).u8(1).u8(1).zeros(92).done();
 if(header.length!==128)fail('Internal Aseprite header error.');return concat([header,body]);
}
