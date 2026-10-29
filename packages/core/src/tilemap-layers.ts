import {activeLayer,makeLayer,rasterCel,checkCelBudget,type PixelDocument,type Layer} from './document.js';
import {groupAncestors} from './groups.js';
export const TILESET_BYTES=1024*1024,TILESET_COUNT=4,TILE_COUNT=256,TILEMAP_CELLS=65536;
export interface PixelTileset {id:string;name:string;width:number;height:number;tiles:Uint8ClampedArray[]}
/** Static across frames, like editable text. Cell flags: diagonal swap, then H/V flips. */
export interface TilemapLayer {tileset:PixelTileset;cells:Int16Array;flags:Uint8Array}
const whole=(v:number,a:number,b:number)=>Number.isInteger(v)&&v>=a&&v<=b;
export function copyTilemap(m:TilemapLayer):TilemapLayer{return {tileset:m.tileset,cells:m.cells.slice(),flags:m.flags.slice()};}
export function tilemapBuffers(layers:readonly Layer[]):(Uint8Array|Uint8ClampedArray|Int16Array)[]{return layers.flatMap(l=>l.tilemap?[l.tilemap.cells,l.tilemap.flags,...l.tilemap.tileset.tiles]:[]);}
export function tilesets(doc:PixelDocument):PixelTileset[]{const out=new Map<string,PixelTileset>();for(const l of doc.layers)if(l.tilemap){const set=l.tilemap.tileset,old=out.get(set.id);if(old&&old!==set)throw Error('Layers sharing a tileset ID must share its exact tileset object.');out.set(set.id,set);}return [...out.values()];}
export function validateTilemapLayers(doc:PixelDocument){
 const sets=tilesets(doc);if(sets.length>TILESET_COUNT)throw Error('Use at most four shared tilesets.');let bytes=0,count=0,cells=0;
 for(const s of sets){if(!s||Object.keys(s).sort().join()!=='height,id,name,tiles,width'||!/^tileset-[1-9][0-9]{0,8}$/.test(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||!whole(s.width,1,64)||!whole(s.height,1,64)||!Array.isArray(s.tiles)||!s.tiles.length||s.tiles.length>TILE_COUNT)throw Error('Invalid shared tileset.');
  for(const p of s.tiles){if(!(p instanceof Uint8ClampedArray)||p.length!==s.width*s.height*4)throw Error('Tiles require complete RGBA bytes.');bytes+=p.byteLength;count++;}
 }
 if(bytes>TILESET_BYTES||count>TILE_COUNT)throw Error('Shared tilesets exceed 256 tiles or 1 MiB.');
 for(const l of doc.layers){const m=l.tilemap;if(!m)continue;const s=m.tileset,n=doc.width/s.width*(doc.height/s.height);cells+=n;
  if(Object.keys(m).sort().join()!=='cells,flags,tileset'||doc.indexed||doc.editingMode||doc.width%s.width||doc.height%s.height||!(m.cells instanceof Int16Array)||!(m.flags instanceof Uint8Array)||m.cells.length!==n||m.flags.length!==n||cells>TILEMAP_CELLS||l.text||l.adjustment||Object.values(l.cels).some(p=>p.length))throw Error('Tilemap layers need divisible RGBA canvas dimensions, empty raw cels and at most 65536 total cells.');
  for(let i=0;i<n;i++)if(!whole(m.cells[i],-1,s.tiles.length-1)||m.flags[i]>7||m.cells[i]===-1&&m.flags[i]!==0||s.width!==s.height&&(m.flags[i]&4))throw Error('Invalid tile reference/transform; quarter turns require square tiles.');
 }
}
export function renderTilemap(m:TilemapLayer,width:number,height:number):Uint8ClampedArray{
 const out=new Uint8ClampedArray(width*height*4),s=m.tileset,columns=width/s.width;
 for(let cell=0;cell<m.cells.length;cell++){const id=m.cells[cell];if(id<0)continue;const tile=s.tiles[id],flags=m.flags[cell],ox=cell%columns*s.width,oy=Math.floor(cell/columns)*s.height;
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){let sx=flags&1?s.width-1-x:x,sy=flags&2?s.height-1-y:y;if(flags&4)[sx,sy]=[sy,sx];const from=(sy*s.width+sx)*4,to=((oy+y)*width+ox+x)*4;out.set(tile.subarray(from,from+4),to);}
 }return out;
}
function encodeBytes(p:Uint8ClampedArray){let value='';for(let i=0;i<p.length;i+=32768)value+=String.fromCharCode(...p.subarray(i,i+32768));return btoa(value);}
export function encodeTilesets(doc:PixelDocument){return tilesets(doc).map(s=>({...s,tiles:s.tiles.map(encodeBytes)}));}
export function decodeTilesets(value:unknown):Map<string,PixelTileset>{
 if(!Array.isArray(value)||value.length<1||value.length>TILESET_COUNT)throw Error('Invalid encoded tilesets.');let bytes=0,count=0;const out=new Map<string,PixelTileset>();
 for(const s of value){if(!s||Object.keys(s).sort().join()!=='height,id,name,tiles,width'||typeof s.id!=='string'||!/^tileset-[1-9][0-9]{0,8}$/.test(s.id)||out.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||!whole(s.width,1,64)||!whole(s.height,1,64)||!Array.isArray(s.tiles)||!s.tiles.length||s.tiles.length>TILE_COUNT)throw Error('Invalid encoded tileset.');const n=s.width*s.height*4;count+=s.tiles.length;bytes+=n*s.tiles.length;if(bytes>TILESET_BYTES||count>TILE_COUNT)throw Error('Shared tilesets exceed 256 tiles or 1 MiB.');
  const tiles=s.tiles.map((v:unknown)=>{if(typeof v!=='string'||v.length!==4*Math.ceil(n/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(v))throw Error('Invalid tileset base64.');const raw=atob(v);if(raw.length!==n||btoa(raw)!==v)throw Error('Noncanonical tileset bytes.');return Uint8ClampedArray.from(raw,c=>c.charCodeAt(0));});out.set(s.id,{id:s.id,name:s.name,width:s.width,height:s.height,tiles});
 }return out;
}
export function decodeTilemap(value:unknown,catalog:Map<string,PixelTileset>,width:number,height:number):TilemapLayer{
 const m=value as {tilesetId:string;cells:number[];flags:number[]};if(!m||Object.keys(m).sort().join()!=='cells,flags,tilesetId'||!catalog.has(m.tilesetId))throw Error('Invalid encoded tilemap.');const tileset=catalog.get(m.tilesetId)!,n=width/tileset.width*(height/tileset.height);
 if(width%tileset.width||height%tileset.height||n>TILEMAP_CELLS||!Array.isArray(m.cells)||!Array.isArray(m.flags)||m.cells.length!==n||m.flags.length!==n||Array.from(m.cells).some(v=>!whole(v,-1,tileset.tiles.length-1))||Array.from(m.flags).some((v,i)=>!whole(v,0,7)||m.cells[i]===-1&&v!==0||tileset.width!==tileset.height&&(v&4)))throw Error('Invalid encoded tilemap cells or transforms.');return {tileset,cells:Int16Array.from(m.cells),flags:Uint8Array.from(m.flags)};
}
export type TilemapOperation=
 |{kind:'tilemap';action:'create';tileWidth:number;tileHeight:number;name:string;populate:boolean}
 |{kind:'tilemap';action:'share';tilesetId:string;name:string}
 |{kind:'tilemap';action:'paint'|'fill';points:{x:number;y:number}[];tile:number;flags:number}
 |{kind:'tilemap';action:'tile-pixel';tile:number;x:number;y:number;color:number[]}
 |{kind:'tilemap';action:'add-tile';copy:number|null}
 |{kind:'tilemap';action:'remap';order:number[];replacement:number}
 |{kind:'tilemap';action:'rasterize'};
function mapLayer(doc:PixelDocument){const l=activeLayer(doc);if(!l.tilemap||!l.visible||l.locked||groupAncestors(doc,l.groupId).some(g=>g.locked||!g.visible))throw Error('Show and unlock a tilemap layer.');return l;}
function nextId(prefix:string,used:string[]){let n=1;while(used.includes(prefix+n))n++;return prefix+n;}
export function tilemapOperation(doc:PixelDocument,o:TilemapOperation){
 validateTilemapLayers(doc);if(doc.indexed||doc.editingMode)throw Error('Tilemap layers require reviewed RGBA editing; indexed slots are never silently converted.');
 const current=activeLayer(doc);
 if(o.action==='create'||o.action==='share'){
  if(typeof o.name!=='string'||!o.name.trim()||o.name.length>80||current.locked||!current.visible||groupAncestors(doc,current.groupId).some(g=>g.locked||!g.visible))throw Error('Use a layer name and show/unlock the source layer and parents.');checkCelBudget(doc.width,doc.height,doc.layers.length+1,doc.frames.length);
  let set:PixelTileset;
  if(o.action==='create'){
   if(current.tilemap||current.text||current.adjustment||!whole(o.tileWidth,1,64)||!whole(o.tileHeight,1,64)||doc.width%o.tileWidth||doc.height%o.tileHeight||typeof o.populate!=='boolean')throw Error('Choose a raw raster source and tile dimensions dividing the canvas.');
   const count=doc.width/o.tileWidth*(doc.height/o.tileHeight);if(count>TILE_COUNT||tilesets(doc).length>=TILESET_COUNT)throw Error('Tileset capture exceeds 256 tiles or four sets.');const raw=rasterCel(doc,current),tiles:Uint8ClampedArray[]=[];
   for(let y=0;y<doc.height;y+=o.tileHeight)for(let x=0;x<doc.width;x+=o.tileWidth){const p=new Uint8ClampedArray(o.tileWidth*o.tileHeight*4);for(let row=0;row<o.tileHeight;row++)p.set(raw.subarray(((y+row)*doc.width+x)*4,((y+row)*doc.width+x+o.tileWidth)*4),row*o.tileWidth*4);tiles.push(p);}
   set={id:nextId('tileset-',tilesets(doc).map(s=>s.id)),name:o.name.trim(),width:o.tileWidth,height:o.tileHeight,tiles};
  }else{const found=tilesets(doc).find(s=>s.id===o.tilesetId);if(!found)throw Error('Choose an existing shared tileset.');set=found;}
  const cells=new Int16Array(doc.width/set.width*(doc.height/set.height)).fill(-1);if(o.action==='create'&&o.populate)for(let i=0;i<cells.length;i++)cells[i]=i;
  const l=makeLayer(doc,nextId('layer-',doc.layers.map(l=>l.id)),o.name.trim(),true,Object.fromEntries(doc.frames.map(f=>[f.id,new Uint8ClampedArray(0)])),{groupId:current.groupId,tilemap:{tileset:set,cells,flags:new Uint8Array(cells.length)}});doc.layers.splice(doc.layers.indexOf(current)+1,0,l);doc.activeLayerId=l.id;
 }else{
  const layer=mapLayer(doc),m=layer.tilemap!,s=m.tileset,columns=doc.width/s.width,rows=doc.height/s.height;
  if(o.action==='paint'||o.action==='fill'){
   if(!Array.isArray(o.points)||!o.points.length||o.points.length>4096||o.points.some(p=>!p||!whole(p.x,0,columns-1)||!whole(p.y,0,rows-1))||!whole(o.tile,-1,s.tiles.length-1)||!whole(o.flags,0,7)||s.width!==s.height&&(o.flags&4))throw Error('Choose valid cells, tile identity and transform.');
   const flag=o.tile<0?0:o.flags,put=(i:number)=>{m.cells[i]=o.tile;m.flags[i]=flag;};
   if(o.action==='paint')for(const p of o.points)put(p.y*columns+p.x);
   else{const seed=o.points[0].y*columns+o.points[0].x,target=m.cells[seed],transform=m.flags[seed];if(target===o.tile&&transform===flag)return;const queue=[seed],seen=new Uint8Array(m.cells.length);while(queue.length){const i=queue.pop()!;if(seen[i]||m.cells[i]!==target||m.flags[i]!==transform)continue;seen[i]=1;put(i);if(i%columns)queue.push(i-1);if(i%columns<columns-1)queue.push(i+1);if(i>=columns)queue.push(i-columns);if(i<m.cells.length-columns)queue.push(i+columns);}}
  }else if(o.action==='rasterize'){const pixels=renderTilemap(m,doc.width,doc.height);layer.cels=Object.fromEntries(doc.frames.map(f=>[f.id,pixels.slice()]));delete layer.tilemap;}
  else{
   const users=doc.layers.filter(l=>l.tilemap?.tileset.id===s.id);if(users.some(l=>l.locked||groupAncestors(doc,l.groupId).some(g=>g.locked)))throw Error('Unlock all layers sharing this tileset before editing tiles or references.');
   const next:PixelTileset={...s,tiles:s.tiles.slice()};
   if(o.action==='tile-pixel'){if(!whole(o.tile,0,s.tiles.length-1)||!whole(o.x,0,s.width-1)||!whole(o.y,0,s.height-1)||!Array.isArray(o.color)||o.color.length!==4||!o.color.every(v=>whole(v,0,255)))throw Error('Choose a tile pixel and complete RGBA bytes.');next.tiles[o.tile]=s.tiles[o.tile].slice();next.tiles[o.tile].set(o.color,(o.y*s.width+o.x)*4);}
   else if(o.action==='add-tile'){if(o.copy!==null&&!whole(o.copy,0,s.tiles.length-1))throw Error('Choose a source tile or a blank tile.');next.tiles.push(o.copy===null?new Uint8ClampedArray(s.width*s.height*4):s.tiles[o.copy].slice());}
   else if(o.action==='remap'){
    if(!Array.isArray(o.order)||!o.order.length||o.order.length>s.tiles.length||new Set(o.order).size!==o.order.length||o.order.some(i=>!whole(i,0,s.tiles.length-1))||!whole(o.replacement,-1,o.order.length-1))throw Error('Use distinct original tile IDs and a destination replacement ID or -1.');
    next.tiles=o.order.map(i=>s.tiles[i]);const inverse=s.tiles.map((_,i)=>o.order.indexOf(i));for(const user of users){const map=user.tilemap!;map.cells=map.cells.map(i=>i<0?-1:inverse[i]<0?o.replacement:inverse[i]);for(let i=0;i<map.cells.length;i++)if(map.cells[i]<0)map.flags[i]=0;}
   }else throw Error('Unknown tileset operation.');
   for(const user of users)user.tilemap!.tileset=next;
  }
 }validateTilemapLayers(doc);
}
