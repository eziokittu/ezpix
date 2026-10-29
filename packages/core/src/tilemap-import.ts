import {createDocument,makeLayer,checkCelBudget,activeLayer,type PixelDocument} from './document.js';
import {readNativeZip} from './native-zip.js';
import {decodeNativePng} from './native-png.js';
import {integer,name,fail} from './native-utils.js';
import {tilesets,validateTilemapLayers,TILESET_BYTES,TILEMAP_CELLS,type PixelTileset} from './tilemap-layers.js';
import {groupAncestors} from './groups.js';

export const TILEMAP_IMPORT_NOTE='Import supports a root map.tmj with one inline PNG atlas, finite orthogonal JSON tile layers, zero offsets, opacity rounded to the nearest 8-bit byte, and H/V/diagonal flags. External tilesets, URLs, image collections, groups, objects, animation, custom properties and compressed/chunked maps reject. Exact encoded PNG RGBA bytes and every atlas slot are retained without profile conversion. Global firstgid becomes local tile IDs. source.ezpix and README.txt are ignored, never used as trusted import data. Apply adds static shared map layers above existing artwork on a matching RGBA canvas, as one Undo.';
function keys(value:unknown,required:string[],optional:string[]=[]){if(!value||typeof value!=='object'||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))fail('Unsupported Tiled fields. '+TILEMAP_IMPORT_NOTE);}
const decoder=new TextDecoder('utf-8',{fatal:true});
/** Strict local atlas subset; directory/CRC/expansion checks run before image decoding. */
export async function decodeTilemapBundle(bytes:Uint8Array):Promise<PixelDocument>{
 const files=await readNativeZip(bytes,false),raw=files.get('map.tmj');if(!raw||raw.length>2*1024*1024)fail('Tiled ZIP needs a root map.tmj of at most 2 MiB.');
 const map=JSON.parse(decoder.decode(raw));keys(map,['type','version','orientation','renderorder','infinite','width','height','tilewidth','tileheight','layers','tilesets'],['nextlayerid','nextobjectid','tiledversion','compressionlevel']);
 if(map.type!=='map'||map.version!=='1.10'||map.orientation!=='orthogonal'||map.renderorder!=='right-down'||map.infinite!==false||!Array.isArray(map.tilesets)||map.tilesets.length!==1||!Array.isArray(map.layers)||!map.layers.length||map.layers.length>16)fail(TILEMAP_IMPORT_NOTE);
 const tw=integer(map.tilewidth,1,64,'Tile width'),th=integer(map.tileheight,1,64,'Tile height'),columns=integer(map.width,1,256,'Map width'),rows=integer(map.height,1,256,'Map height'),width=columns*tw,height=rows*th;
 if(width>256||height>256||columns*rows*map.layers.length>TILEMAP_CELLS)fail('Imported map exceeds 256px axes or 65536 aggregate cells.');checkCelBudget(width,height,map.layers.length,1);
 const set=map.tilesets[0];keys(set,['firstgid','name','image','imagewidth','imageheight','tilewidth','tileheight','tilecount','columns','margin','spacing']);
 const count=integer(set.tilecount,1,256,'Tile count'),first=integer(set.firstgid,1,0x10000000-count,'First global ID'),atlasColumns=integer(set.columns,1,256,'Atlas columns');name(set.name,'Tileset name');
 if(set.tilewidth!==tw||set.tileheight!==th||set.margin!==0||set.spacing!==0||atlasColumns>count||set.imagewidth!==atlasColumns*tw||set.imageheight!==Math.ceil(count/atlasColumns)*th||count*tw*th*4>TILESET_BYTES||set.imagewidth*set.imageheight>1048576||typeof set.image!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9 _.\-]{0,100}\.png$/.test(set.image))fail('Use one bounded, unspaced local PNG atlas with matching tile dimensions.');
 if(!files.has(set.image)||[...files.keys()].some(path=>!['map.tmj',set.image,'source.ezpix','README.txt'].includes(path)))fail('Unexpected or missing Tiled ZIP files. Only the local map/atlas and optional ignored source.ezpix/README.txt are supported.');
 const ids=new Set<number>();for(const layer of map.layers){keys(layer,['id','name','type','width','height','x','y','opacity','visible','data']);integer(layer.id,1,2147483647,'Layer ID');name(layer.name,'Layer name');
  if(ids.has(layer.id)||layer.type!=='tilelayer'||layer.width!==columns||layer.height!==rows||layer.x!==0||layer.y!==0||typeof layer.visible!=='boolean'||!Number.isFinite(layer.opacity)||layer.opacity<0||layer.opacity>1||!Array.isArray(layer.data)||layer.data.length!==columns*rows)fail('Unsupported Tiled layer dimensions, identity, opacity or cell data.');ids.add(layer.id);
  for(const gid of layer.data){integer(gid,0,0xffffffff,'Global tile ID');const tile=gid&0x0fffffff;if(gid&0x10000000||(!tile&&gid!==0)||tile!==0&&(tile<first||tile>=first+count)||tw!==th&&(gid&0x20000000))fail('Unknown global tile ID or unsupported transform; diagonal flags require square tiles.');}
 }
 const atlas=await decodeNativePng(files.get(set.image)!,set.imagewidth,set.imageheight),tiles:Uint8ClampedArray[]=[];
 for(let id=0;id<count;id++){const tile=new Uint8ClampedArray(tw*th*4);for(let y=0;y<th;y++){const at=((Math.floor(id/atlasColumns)*th+y)*set.imagewidth+id%atlasColumns*tw)*4;tile.set(atlas.subarray(at,at+tw*4),y*tw*4);}tiles.push(tile);}
 const doc=createDocument(width,height,'Imported tilemap'),shared:PixelTileset={id:'tileset-1',name:set.name,width:tw,height:th,tiles};
 doc.layers=map.layers.map((layer:{name:string;visible:boolean;opacity:number;data:number[]},index:number)=>{const cells=Int16Array.from(layer.data,gid=>gid===0?-1:(gid&0x0fffffff)-first),flags=Uint8Array.from(layer.data,gid=>(gid&0x80000000?1:0)|(gid&0x40000000?2:0)|(gid&0x20000000?4:0));return makeLayer(doc,`layer-${index+1}`,layer.name,layer.visible,{'frame-1':new Uint8ClampedArray(0)},{opacity:Math.round(layer.opacity*255),tilemap:{tileset:shared,cells,flags}});});doc.activeLayerId=doc.layers.at(-1)!.id;validateTilemapLayers(doc);return doc;
}

/** Add detached decoded map layers, retaining the current sprite, timeline and palette. */
export function appendTilemaps(doc:PixelDocument,source:PixelDocument){
 validateTilemapLayers(doc);validateTilemapLayers(source);const current=activeLayer(doc);
 if(doc.indexed||doc.editingMode||doc.outputMode||doc.width!==source.width||doc.height!==source.height)fail('Tiled import needs a matching-size RGBA canvas without output conversion. Create that canvas first.');
 if(current.locked||!current.visible||groupAncestors(doc,current.groupId).some(g=>g.locked||!g.visible))fail('Show and unlock the current layer and parents before importing maps.');
 if(!source.layers.length||source.layers.some(l=>!l.tilemap||l.text||l.adjustment||l.groupId||l.blendMode!=='normal'||l.mask||l.effects?.length)||source.outputMode||source.indexed||source.editingMode)fail('Import only plain static tilemap layers.');
 checkCelBudget(doc.width,doc.height,doc.layers.length+source.layers.length,doc.frames.length);
 const used=new Set(tilesets(doc).map(s=>s.id)),copies=new Map<string,PixelTileset>();for(const s of tilesets(source)){let n=1;while(used.has(`tileset-${n}`))n++;const id=`tileset-${n}`;used.add(id);copies.set(s.id,{...s,id,tiles:s.tiles.map(p=>p.slice())});}
 for(const l of source.layers){let n=1;while(doc.layers.some(p=>p.id===`layer-${n}`))n++;const m=l.tilemap!,tilemap={tileset:copies.get(m.tileset.id)!,cells:m.cells.slice(),flags:m.flags.slice()},layer=makeLayer(doc,`layer-${n}`,l.name,l.visible,Object.fromEntries(doc.frames.map(f=>[f.id,new Uint8ClampedArray(0)])),{opacity:l.opacity,tilemap});doc.layers.push(layer);doc.activeLayerId=layer.id;}
 validateTilemapLayers(doc);
}
