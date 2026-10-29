import {largeLayer,validateLargeProject,type LargeProject,type LargeRect} from './large-canvas.js';
import {createLargeIndexed,largeRawIndex} from './large-indexed.js';
import {copyRawIndexedRaster,type RawIndexedRaster,RAW_INDEXED_PNG_PIXELS} from './raw-indexed-png.js';
/** Raw selected-layer/frame rectangle. Membership, layer opacity and saved coverage are separate. */
export function captureLargeIndexedPng(source:LargeProject,rect:LargeRect):RawIndexedRaster {
 validateLargeProject(source);if(!source.indexed)throw Error('Raw indexed PNG requires indexed artwork.');
 if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>source.width||rect.y+rect.height>source.height||rect.width*rect.height>RAW_INDEXED_PNG_PIXELS)throw Error('Raw indexed PNG rectangle must fit the canvas and one megapixel.');
 const layer=largeLayer(source),indices=new Uint8Array(rect.width*rect.height);
 for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++)indices[y*rect.width+x]=largeRawIndex(source,layer,source.activeFrameId,rect.x+x,rect.y+y);
 return {width:rect.width,height:rect.height,palette:source.indexed.palette.map(p=>[...p]),indices};
}
/** Create an independent project. Role choice is explicit; no RGBA matching or slot remapping. */
export function largeFromIndexedPng(input:RawIndexedRaster,clearSlot:number|'append',name='Imported indexed PNG'):LargeProject {
 const c=copyRawIndexedRaster(input);
 if(clearSlot==='append') {if(c.palette.length>=256)throw Error('This PNG has 256 slots and no spare clear slot. Use an existing zero-alpha slot or reviewed RGBA import.');clearSlot=c.palette.length;c.palette.push([0,0,0,0]);}
 if(!Number.isInteger(clearSlot)||clearSlot<0||clearSlot>=c.palette.length||c.palette[clearSlot][3]!==0)throw Error('Choose a zero-alpha palette slot as the editor clear role, or explicitly append a new clear slot.');
 const d=createLargeIndexed(c.width,c.height,c.palette,clearSlot,clearSlot,name),tiles=d.layers[0].cels[d.activeFrameId];
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const index=c.indices[y*c.width+x];if(index===clearSlot)continue;
  const key=Math.floor(x/64)+','+Math.floor(y/64);let tile=tiles.get(key);if(!tile){tile=new Uint8ClampedArray(4096);tile.fill(clearSlot);tiles.set(key,tile);}tile[(y%64)*64+x%64]=index;
 }
 validateLargeProject(d);return d;
}
