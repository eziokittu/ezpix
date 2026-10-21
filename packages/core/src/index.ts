import {finishPixels} from './quick.js';
import { brushOffsets, type Brush } from './brush.js';
export * from './brush.js';
export * from './color.js';
import { activeLayer, MAX_LAYERS, checkCelBudget,copyLayer,makeLayer,validateDuration, type Frame, type PixelDocument, type RGBA, type Layer } from './document.js';
import { shapePoints, transformSelection, validatePalette, type Shape, type Point, type Selection, type Transform } from './toolkit.js';
export * from './document.js';
export * from './conversion.js';
export * from './toolkit.js';
export * from './sheet.js';
export * from './tiles.js';
export * from './quick.js';
export type Delta = { index: number; before: number[]; after: number[] };
type LayerState = { layers: Layer[]; activeLayerId: string;frames:Frame[];activeFrameId:string };
type Command = { bytes: number } & ({ kind:'pixels'; layerId:string;frameId:string; changes:Delta[] } | {kind:'bitmap';layerId:string;frameId:string;before:Uint8ClampedArray;after:Uint8ClampedArray} | {kind:'layers'; before:LayerState; after:LayerState}|{kind:'palette';before:string[];after:string[]});
/** A gesture is one command; one entry per changed pixel, including mirrored pixels. */
export class PixelEditor {
  readonly document: PixelDocument;
  private pending = new Map<number, Delta>();
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private bytes = 0;
  evicted = false;
  constructor(document: PixelDocument, readonly historyBudget = 8 * 1024 * 1024) { this.document = document; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get historyBytes() { return this.bytes; }
  setPalette(colors:readonly string[]) {this.commit();const after=validatePalette(colors),before=this.document.palette.slice();if(before.join()===after.join())return false;this.document.palette=after;this.record({kind:'palette',before,after,bytes:(before.length+after.length)*64});return true;}
  shape(kind:Shape,a:Point,b:Point,color:RGBA,filled=false) {for(const p of shapePoints(kind,a,b,filled))this.paint(p.x,p.y,color);}
  applySelection(selection:Selection,options:Transform) {
    this.commit();const doc=this.document,layer=activeLayer(doc);
    if(layer.id!==selection.layerId||doc.activeFrameId!==selection.frameId||!layer.visible||doc.width!==selection.canvasWidth||doc.height!==selection.canvasHeight||layer.pixels.length!==selection.baseline.length||!layer.pixels.every((v,i)=>v===selection.baseline[i]))throw new Error('The selected cel changed. Cancel and select its pixels again.');
    const pixels=transformSelection(selection,options);
    for(let p=0;p<pixels.length;p+=4)if(!pixels.subarray(p,p+4).every((v,i)=>v===layer.pixels[p+i]))this.paint(p/4%doc.width,Math.floor(p/4/doc.width),[pixels[p],pixels[p+1],pixels[p+2],pixels[p+3]]);
    return this.commit();
  }
  finishArtwork(kind:'outline'|'speckles',color:RGBA) {this.commit();const doc=this.document,layer=activeLayer(doc);if(!layer.visible)throw new Error('Show the selected layer before finishing.');const next=finishPixels({width:doc.width,height:doc.height,pixels:layer.pixels},kind,color);for(let p=0;p<next.length;p+=4)if(next[p]!==layer.pixels[p]||next[p+1]!==layer.pixels[p+1]||next[p+2]!==layer.pixels[p+2]||next[p+3]!==layer.pixels[p+3])this.paint(p/4%doc.width,Math.floor(p/4/doc.width),[next[p],next[p+1],next[p+2],next[p+3]]);return this.commit();}
  selectLayer(id:string) { this.commit(); if(!this.document.layers.some(l=>l.id===id))throw new Error('Layer is missing.');this.document.activeLayerId=id; }
  selectFrame(id:string) {this.commit();if(!this.document.frames.some(f=>f.id===id))throw new Error('Frame is missing.');this.document.activeFrameId=id;}
  addFrame(duplicate=false) {
    const doc=this.document;checkCelBudget(doc.width,doc.height,doc.layers.length,doc.frames.length+1);
    return this.changeLayers(()=>{let next=1;while(doc.frames.some(f=>f.id===`frame-${next}`))next++;const id=`frame-${next}`,index=doc.frames.findIndex(f=>f.id===doc.activeFrameId),current=doc.frames[index];
      for(const layer of doc.layers)layer.cels[id]=duplicate?layer.pixels.slice():new Uint8ClampedArray(doc.width*doc.height*4);
      doc.frames.splice(index+1,0,{id,duration:duplicate?current.duration:100});doc.activeFrameId=id;return true;});
  }
  deleteFrame() {if(this.document.frames.length===1)throw new Error('Keep at least one frame.');return this.changeLayers(()=>{const doc=this.document,index=doc.frames.findIndex(f=>f.id===doc.activeFrameId);for(const l of doc.layers)delete l.cels[doc.activeFrameId];doc.frames.splice(index,1);doc.activeFrameId=doc.frames[Math.min(index,doc.frames.length-1)].id;return true;});}
  moveFrame(direction:1|-1) {return this.changeLayers(()=>{const doc=this.document,i=doc.frames.findIndex(f=>f.id===doc.activeFrameId),next=i+direction;if(next<0||next>=doc.frames.length)return false;[doc.frames[i],doc.frames[next]]=[doc.frames[next],doc.frames[i]];return true;});}
  setFrameDuration(duration:number) {validateDuration(duration);return this.changeLayers(()=>{const f=this.document.frames.find(f=>f.id===this.document.activeFrameId)!;if(f.duration===duration)return false;f.duration=duration;return true;});}
  private layerState():LayerState {const doc=this.document;return {layers:doc.layers.map(l=>copyLayer(doc,l)),activeLayerId:doc.activeLayerId,frames:doc.frames.map(f=>({...f})),activeFrameId:doc.activeFrameId}; }
  private restore(state:LayerState) {const doc=this.document;doc.frames=state.frames.map(f=>({...f}));doc.activeFrameId=state.activeFrameId;doc.layers=state.layers.map(l=>copyLayer(doc,l));doc.activeLayerId=state.activeLayerId; }
  private record(command:Command) {
    this.bytes-=this.redoStack.reduce((n,c)=>n+c.bytes,0);this.redoStack=[];
    this.undoStack.push(command);this.bytes+=command.bytes;
    while(this.bytes>this.historyBudget||this.undoStack.length>100){this.bytes-=this.undoStack.shift()!.bytes;this.evicted=true;}
  }
  private changeLayers(change:()=>boolean) {
    this.commit();const before=this.layerState();if(!change())return false;const after=this.layerState();
    // Snapshots share pixel buffers; budget counts every buffer retained by a command.
    const buffers=new Set([...before.layers,...after.layers].flatMap(l=>Object.values(l.cels)));
    this.record({kind:'layers',before,after,bytes:[...buffers].reduce((n,p)=>n+p.byteLength,0)+(before.layers.length+after.layers.length+before.frames.length+after.frames.length)*256});return true;
  }
  addLayer(duplicate=false) {
    if(this.document.layers.length>=MAX_LAYERS)throw new Error('A project supports at most 16 layers.');
    checkCelBudget(this.document.width,this.document.height,this.document.layers.length+1,this.document.frames.length);
    return this.changeLayers(()=>{const doc=this.document,current=activeLayer(doc);let next=1;while(doc.layers.some(l=>l.id===`layer-${next}`))next++;const id=`layer-${next}`;
      const layer=makeLayer(doc,id,duplicate?`${current.name.slice(0,70)} copy`:`Layer ${doc.layers.length+1}`,true,Object.fromEntries(doc.frames.map(f=>[f.id,duplicate?current.cels[f.id].slice():new Uint8ClampedArray(doc.width*doc.height*4)])));
      doc.layers.splice(doc.layers.indexOf(current)+1,0,layer);doc.activeLayerId=id;return true;});
  }
  deleteLayer() {
    if(this.document.layers.length===1)throw new Error('Keep at least one layer.');
    return this.changeLayers(()=>{const doc=this.document,index=doc.layers.indexOf(activeLayer(doc));doc.layers.splice(index,1);doc.activeLayerId=doc.layers[Math.min(index,doc.layers.length-1)].id;return true;});
  }
  renameLayer(name:string) { const clean=name.trim();if(!clean||clean.length>80)throw new Error('Layer names need 1–80 characters.');return this.changeLayers(()=>{const layer=activeLayer(this.document);if(layer.name===clean)return false;layer.name=clean;return true;}); }
  toggleLayer() {return this.changeLayers(()=>{const layer=activeLayer(this.document);layer.visible=!layer.visible;return true;});}
  moveLayer(direction:1|-1) {return this.changeLayers(()=>{const doc=this.document,i=doc.layers.indexOf(activeLayer(doc)),next=i+direction;if(next<0||next>=doc.layers.length)return false;[doc.layers[i],doc.layers[next]]=[doc.layers[next],doc.layers[i]];return true;});}
  paint(x: number, y: number, color: RGBA, mirrorX = false, mirrorY = false) {
    if(!activeLayer(this.document).visible)return;
    const { width, height } = this.document;
    for (const px of mirrorX ? [x, width - 1 - x] : [x]) {
      for (const py of mirrorY ? [y, height - 1 - y] : [y]) {
        if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= width || py >= height) continue;
        const index = (py * width + px) * 4;
        const pixels = this.document.cel.pixels;
        if (color.every((v, i) => pixels[index + i] === v)) continue;
        const previous = this.pending.get(index);
        this.pending.set(index, { index, before: previous?.before ?? Array.from(pixels.slice(index, index + 4)), after: [...color] });
        pixels.set(color, index);
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, color: RGBA, mx = false, my = false, brush:Brush={size:1,shape:'square'}) {
    const offsets=brushOffsets(brush);
    const {width,height}=this.document;
    if(![x0,x1].every(x=>Number.isInteger(x)&&x>=0&&x<width)||![y0,y1].every(y=>Number.isInteger(y)&&y>=0&&y<height))throw new Error('Stroke anchors must be whole pixels inside the canvas.');
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      for(const offset of offsets)this.paint(x0+offset.x,y0+offset.y,color,mx,my);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  fill(x: number, y: number, color: RGBA) {
    if(!activeLayer(this.document).visible)return;
    const { width, height, cel: { pixels } } = this.document;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const target = pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4);
    if (color.every((v, i) => v === target[i])) return;
    const queue = [y * width + x], seen = new Uint8Array(width * height);
    while (queue.length) {
      const p = queue.pop()!;
      if (seen[p]) continue;
      seen[p] = 1;
      if (!target.every((v, i) => pixels[p * 4 + i] === v)) continue;
      this.paint(p % width, Math.floor(p / width), color);
      if (p % width > 0) queue.push(p - 1);
      if (p % width < width - 1) queue.push(p + 1);
      if (p >= width) queue.push(p - width);
      if (p < width * (height - 1)) queue.push(p + width);
    }
  }
  commit() {
    const changes = [...this.pending.values()].filter(d => d.before.some((v, i) => v !== d.after[i]));
    this.pending.clear();
    if (!changes.length) return false;
    if(changes.length>1024&&changes.length*512>this.document.cel.pixels.byteLength*2+256){
      const after=this.document.cel.pixels.slice(),before=after.slice();for(const d of changes)before.set(d.before,d.index);
      this.record({kind:'bitmap',layerId:this.document.activeLayerId,frameId:this.document.activeFrameId,before,after,bytes:before.byteLength+after.byteLength+256});
    }else this.record({kind:'pixels',layerId:this.document.activeLayerId,frameId:this.document.activeFrameId,changes,bytes:changes.length*512});
    return true;
  }
  undo() {
    const command = this.undoStack.pop(); if (!command) return false;
    if(command.kind==='palette')this.document.palette=command.before.slice();
    else if(command.kind==='layers')this.restore(command.before);
    else if(command.kind==='bitmap'){const layer=this.document.layers.find(l=>l.id===command.layerId)!;this.document.activeLayerId=layer.id;this.document.activeFrameId=command.frameId;layer.pixels.set(command.before);}
    else {const layer=this.document.layers.find(l=>l.id===command.layerId)!;this.document.activeLayerId=layer.id;this.document.activeFrameId=command.frameId;for(const d of command.changes)layer.pixels.set(d.before,d.index);}
    this.redoStack.push(command); return true;
  }
  redo() {
    const command = this.redoStack.pop(); if (!command) return false;
    if(command.kind==='palette')this.document.palette=command.after.slice();
    else if(command.kind==='layers')this.restore(command.after);
    else if(command.kind==='bitmap'){const layer=this.document.layers.find(l=>l.id===command.layerId)!;this.document.activeLayerId=layer.id;this.document.activeFrameId=command.frameId;layer.pixels.set(command.after);}
    else {const layer=this.document.layers.find(l=>l.id===command.layerId)!;this.document.activeLayerId=layer.id;this.document.activeFrameId=command.frameId;for(const d of command.changes)layer.pixels.set(d.after,d.index);}
    this.undoStack.push(command); return true;
  }
}

export * from './native-aseprite.js';
export * from './native-piskel.js';
export {MAX_NATIVE_BYTES} from './native-utils.js';
