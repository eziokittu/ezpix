import {encodeProject,decodeProject,type PixelDocument} from './document.js';
import {tilesets,validateTilemapLayers} from './tilemap-layers.js';
import {encodeNativePng} from './native-png.js';
import {writeNativeZip} from './native-zip.js';

export const TILEMAP_EXPORT_NOTE='Tiled export contains static orthogonal tilemap layers and exact RGBA atlas slots, including unused/duplicate tiles and flip flags. Raster/text/adjustment layers, animation, references and editor metadata are omitted from map.tmj; source.ezpix retains the whole editable project without conversion source images. Map groups, masks, effects, non-Normal blends, mixed tile sizes and document output conversion require rasterization or a different export.';
/** Finite Tiled JSON format and global IDs: doc.mapeditor.org/en/stable/reference/. */
export async function exportTilemapBundle(document:PixelDocument):Promise<Map<string,Uint8Array>>{
 const baseline=encodeProject(document,false),doc=decodeProject(baseline);validateTilemapLayers(doc);
 const maps=doc.layers.filter(l=>l.tilemap),sets=tilesets(doc),first=sets[0];
 if(!first)throw Error('Create a tilemap layer before exporting Tiled.');
 if(doc.outputMode||sets.some(s=>s.width!==first.width||s.height!==first.height)||maps.some(l=>l.groupId||l.blendMode!=='normal'||l.mask?.enabled||l.effects?.some(e=>e.enabled)))throw Error(TILEMAP_EXPORT_NOTE);
 const utf8=new TextEncoder(),files=new Map<string,Uint8Array>(),starts=new Map<string,number>();let firstgid=1;
 const catalog=[];
 for(let index=0;index<sets.length;index++){
  const set=sets[index],columns=Math.min(16,set.tiles.length),rows=Math.ceil(set.tiles.length/columns),width=columns*set.width,height=rows*set.height,pixels=new Uint8ClampedArray(width*height*4),image=`tileset-${index+1}.png`;
  set.tiles.forEach((tile,id)=>{for(let y=0;y<set.height;y++)pixels.set(tile.subarray(y*set.width*4,(y+1)*set.width*4),((Math.floor(id/columns)*set.height+y)*width+id%columns*set.width)*4);});
  files.set(image,await encodeNativePng(width,height,pixels));starts.set(set.id,firstgid);
  catalog.push({firstgid,name:set.name,image,imagewidth:width,imageheight:height,tilewidth:set.width,tileheight:set.height,tilecount:set.tiles.length,columns,margin:0,spacing:0});firstgid+=set.tiles.length;
 }
 const width=doc.width/first.width,height=doc.height/first.height;
 const layers=maps.map((l,index)=>{const m=l.tilemap!,start=starts.get(m.tileset.id)!;return {id:index+1,name:l.name,type:'tilelayer',width,height,x:0,y:0,opacity:l.opacity/255,visible:l.visible,data:Array.from(m.cells,(id,i)=>id<0?0:((start+id)|(m.flags[i]&1?0x80000000:0)|(m.flags[i]&2?0x40000000:0)|(m.flags[i]&4?0x20000000:0))>>>0)};});
 files.set('map.tmj',utf8.encode(JSON.stringify({type:'map',version:'1.10',orientation:'orthogonal',renderorder:'right-down',infinite:false,width,height,tilewidth:first.width,tileheight:first.height,nextlayerid:layers.length+1,nextobjectid:1,layers,tilesets:catalog},null,2)+'\n'));
 files.set('source.ezpix',utf8.encode(baseline));files.set('README.txt',utf8.encode(TILEMAP_EXPORT_NOTE+'\nOpen map.tmj in Tiled with the adjacent PNG files. Reopen source.ezpix in EzPix to retain all authoring data. This export has automated format/pixel checks; external editor and engine qualification is separate.\n'));
 if(encodeProject(document,false)!==baseline)throw Error('Artwork changed during Tiled export. Export again.');
 // Apply the shared aggregate archive limits before offering any download.
 writeNativeZip(files);return files;
}
