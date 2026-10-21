import {validateRaster,type Raster} from './conversion.js';
import {composite,type PixelDocument} from './document.js';
export const MAX_TILE_BYTES=1024*1024, MAX_TILE_FILE_BYTES=2*1024*1024;
export interface TileProject {tileWidth:number;tileHeight:number;width:number;height:number;tiles:Uint8ClampedArray[];cells:Int16Array}
function int(n:number,min:number,max:number){return Number.isInteger(n)&&n>=min&&n<=max;}
function bounds(tw:number,th:number,w:number,h:number,count:number){if(!int(tw,1,64)||!int(th,1,64)||!int(w,1,64)||!int(h,1,64)||!int(count,1,64)||tw*th*count*4>MAX_TILE_BYTES||tw*th*w*h>4*1024*1024)throw new Error('Tiles: 1-64 pixels per axis, 1-64 unique tiles, map 1-64 cells per axis and at most 4 megapixels.');}
/** Exact deduplication, collision checked. Inputs are copied, never retained. */
export function createTileProject(input:Raster[],width=16,height=16,deduplicate=true):TileProject {
  if(!Array.isArray(input)||!int(input.length,1,256))throw new Error('Choose 1-256 source tiles.');
  const tw=input[0]?.width,th=input[0]?.height;bounds(tw,th,width,height,1);
  const tiles:Uint8ClampedArray[]=[],buckets=new Map<number,number[]>();
  for(const raster of input){validateRaster(raster);if(raster.width!==tw||raster.height!==th)throw new Error('All tiles must have the same size.');const pixels=raster.pixels.slice();let hash=2166136261;
    for(let p=0;p<pixels.length;p+=4){if(!pixels[p+3])pixels.fill(0,p,p+4);for(let c=0;c<4;c++)hash=Math.imul(hash^pixels[p+c],16777619);}
    const candidates=buckets.get(hash)??[];if(deduplicate&&candidates.some(i=>tiles[i].every((v,p)=>v===pixels[p])))continue;
    bounds(tw,th,width,height,tiles.length+1);candidates.push(tiles.length);buckets.set(hash,candidates);tiles.push(pixels);
  }
  return {tileWidth:tw,tileHeight:th,width,height,tiles,cells:new Int16Array(width*height).fill(-1)};
}
export function tilesFromSheet(source:Raster,tw:number,th:number,width=16,height=16,deduplicate=true):TileProject {
  validateRaster(source);bounds(tw,th,width,height,1);
  if(source.width%tw||source.height%th||source.width/tw*(source.height/th)>256)throw new Error('Sheet must be an exact grid with at most 256 source cells.');
  const input:Raster[]=[];for(let y=0;y<source.height;y+=th)for(let x=0;x<source.width;x+=tw){const pixels=new Uint8ClampedArray(tw*th*4);for(let row=0;row<th;row++){const p=((y+row)*source.width+x)*4;pixels.set(source.pixels.subarray(p,p+tw*4),row*tw*4);}input.push({width:tw,height:th,pixels});}
  return createTileProject(input,width,height,deduplicate);
}
export function tilesFromDocument(doc:PixelDocument,width=16,height=16,deduplicate=true){return createTileProject(doc.frames.map(f=>({width:doc.width,height:doc.height,pixels:composite(doc,f.id)})),width,height,deduplicate);}
export function starterTileProject(width=16,height=16):TileProject {
  const colors=[[54,130,66],[38,108,172],[168,124,75],[118,80,104]],input=colors.map((rgb,t)=>{const pixels=new Uint8ClampedArray(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=(y*16+x)*4,shade=t===3?(y%8===0||(x+(y<8?0:8))%16===0?-30:0):((x*7+y*11)%13<3?16:0);for(let c=0;c<3;c++)pixels[p+c]=rgb[c]+shade;pixels[p+3]=255;}return {width:16,height:16,pixels};});return createTileProject(input,width,height);
}
export function renderTileMap(project:TileProject,scale=1):Raster {
  bounds(project.tileWidth,project.tileHeight,project.width,project.height,project.tiles.length);
  const width=project.width*project.tileWidth*scale,height=project.height*project.tileHeight*scale;
  if(!int(scale,1,4)||width*height>4*1024*1024||width>4096||height>4096)throw new Error('Map PNG exceeds 4096 per axis or 4 megapixels. Reduce scale.');
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let cy=0;cy<project.height;cy++)for(let cx=0;cx<project.width;cx++){const id=project.cells[cy*project.width+cx];if(id<0)continue;const tile=project.tiles[id];for(let y=0;y<project.tileHeight*scale;y++)for(let x=0;x<project.tileWidth*scale;x++){const s=(Math.floor(y/scale)*project.tileWidth+Math.floor(x/scale))*4,d=((cy*project.tileHeight*scale+y)*width+cx*project.tileWidth*scale+x)*4;for(let c=0;c<4;c++)pixels[d+c]=tile[s+c];}}
  return {width,height,pixels};
}
export function tileAtlas(project:TileProject){const columns=Math.ceil(Math.sqrt(project.tiles.length)),rows=Math.ceil(project.tiles.length/columns),atlas={...project,width:columns,height:rows,cells:new Int16Array(columns*rows).fill(-1)};for(let i=0;i<project.tiles.length;i++)atlas.cells[i]=i;return {raster:renderTileMap(atlas),metadata:{format:'ezpix-tilemap',version:1,image:'tiles.png',tileWidth:project.tileWidth,tileHeight:project.tileHeight,columns,tileCount:project.tiles.length,width:project.width,height:project.height,empty:-1,cells:Array.from(project.cells)}};}
function b64(p:Uint8ClampedArray){let s='';for(let i=0;i<p.length;i+=32768)s+=String.fromCharCode(...p.subarray(i,i+32768));return btoa(s);}
export function encodeTileProject(p:TileProject):string {bounds(p.tileWidth,p.tileHeight,p.width,p.height,p.tiles.length);const text=JSON.stringify({format:'ezpix-tiles',version:1,tileWidth:p.tileWidth,tileHeight:p.tileHeight,width:p.width,height:p.height,tiles:p.tiles.map(b64),cells:Array.from(p.cells)});if(text.length>MAX_TILE_FILE_BYTES)throw new Error('Tile project exceeds 2 MiB.');return text;}
export function decodeTileProject(text:string):TileProject {
  if(text.length>MAX_TILE_FILE_BYTES||new TextEncoder().encode(text).length>MAX_TILE_FILE_BYTES)throw new Error('Tile project exceeds 2 MiB.');let d;try{d=JSON.parse(text);}catch{throw new Error('Unreadable tile project.');}
  if(!d||d.format!=='ezpix-tiles'||d.version!==1||!Array.isArray(d.tiles))throw new Error('Unsupported tile project.');bounds(d.tileWidth,d.tileHeight,d.width,d.height,d.tiles.length);const length=d.tileWidth*d.tileHeight*4;
  if(!Array.isArray(d.cells)||d.cells.length!==d.width*d.height||!d.cells.every((v:number)=>int(v,-1,d.tiles.length-1))||!d.tiles.every((v:unknown)=>typeof v==='string'&&v.length===4*Math.ceil(length/3)&&/^[A-Za-z0-9+/]*={0,2}$/.test(v)))throw new Error('Invalid tile pixels or map cells.');
  const tiles=d.tiles.map((v:string)=>{const bytes=atob(v);if(bytes.length!==length)throw new Error('Invalid tile byte count.');return Uint8ClampedArray.from(bytes,c=>c.charCodeAt(0));});return {tileWidth:d.tileWidth,tileHeight:d.tileHeight,width:d.width,height:d.height,tiles,cells:Int16Array.from(d.cells)};
}
export class TileEditor {
  private before:Int16Array|null=null;private undoStack:{before:Int16Array;after:Int16Array}[]=[];private redoStack:{before:Int16Array;after:Int16Array}[]=[];
  constructor(readonly document:TileProject){}
  get canUndo(){return this.undoStack.length>0;}get canRedo(){return this.redoStack.length>0;}
  get historyBytes(){return (this.undoStack.length+this.redoStack.length)*this.document.cells.byteLength*2;}
  paint(x:number,y:number,tile:number){const d=this.document;if(!int(tile,-1,d.tiles.length-1))throw new Error('Tile is missing.');if(!int(x,0,d.width-1)||!int(y,0,d.height-1))return false;const p=y*d.width+x;if(d.cells[p]===tile)return false;if(!this.before)this.before=d.cells.slice();d.cells[p]=tile;return true;}
  fill(x:number,y:number,tile:number){const d=this.document;if(!int(x,0,d.width-1)||!int(y,0,d.height-1))return;const target=d.cells[y*d.width+x];if(target===tile)return;const queue=[y*d.width+x],seen=new Uint8Array(d.cells.length);while(queue.length){const p=queue.pop()!;if(seen[p]||d.cells[p]!==target)continue;seen[p]=1;this.paint(p%d.width,Math.floor(p/d.width),tile);if(p%d.width)queue.push(p-1);if(p%d.width<d.width-1)queue.push(p+1);if(p>=d.width)queue.push(p-d.width);if(p<d.width*(d.height-1))queue.push(p+d.width);}}
  pattern(kind:'fill'|'checker'|'border'|'clear',tile:number){for(let y=0;y<this.document.height;y++)for(let x=0;x<this.document.width;x++)this.paint(x,y,kind==='clear'?-1:kind==='fill'||kind==='checker'&&(x+y)%2===0||kind==='border'&&(x===0||y===0||x===this.document.width-1||y===this.document.height-1)?tile:-1);return this.commit();}
  commit(){if(!this.before)return false;const before=this.before;this.before=null;if(before.every((v,i)=>v===this.document.cells[i]))return false;this.undoStack.push({before,after:this.document.cells.slice()});this.redoStack=[];if(this.undoStack.length>64)this.undoStack.shift();return true;}
  undo(){this.commit();const c=this.undoStack.pop();if(!c)return false;this.document.cells.set(c.before);this.redoStack.push(c);return true;}
  redo(){this.commit();const c=this.redoStack.pop();if(!c)return false;this.document.cells.set(c.after);this.undoStack.push(c);return true;}
}
