import {copyTilemap,tilemapBuffers,validateTilemapLayers} from './tilemap-layers.js';
export * from './tilemap-layers.js';
export * from './tilemap-export.js';
export * from './tilemap-import.js';
import {prepareIndexedSelection} from './indexed-selection.js';
import {indexedGeometryAuthored} from './indexed-geometry.js';
export * from './indexed-selection.js';
export * from './indexed-geometry.js';
import {validateIndexedDocument} from './indexed-document.js';
export * from './indexed-document.js';
export * from './indexed-cel.js';
export * from './raw-indexed-png.js';
export * from './large-indexed-png.js';
import {editingInk,editingPixels,editingPalette,validateEditingPolicy} from './editing-policy.js';
export * from './editing-policy.js';
export * from './document-workspace.js';
import {regenerateDocumentOutput,setDocumentOutput,type DocumentOutputPlan,type DocumentOutput} from './document-output.js';
export * from './document-output.js';
export * from './cel-grid.js';
export * from './reference-overlay.js';
export * from './asset-export.js';
import {authoredState,restoreAuthored,regenerateAuthored,type AuthoredPlan,type AuthoredState} from './authored-workflows.js';
export * from './authored-workflows.js';
export * from './authored-metadata.js';
export * from './bitmap-text.js';
import {regenerateReferenceTransform,type ReferenceTransformPlan} from './reference-transform.js';
export * from './reference-transform.js';
import {regenerateLayerWorkflow,type LayerWorkflowPlan} from './layer-workflows.js';
export * from './layer-workflows.js';
export * from './layer-render.js';
import {validateBlendMode,type BlendMode} from './blend.js';
export * from './blend.js';
import {regenerateCoverage,type CoveragePlan} from './coverage.js';
export * from './coverage.js';
export * from './selection-mask.js';
export * from './canvas-tools.js';
import {regenerateStudio,type StudioPlan} from './studio.js';
export * from './studio.js';
export * from './commands.js';
export * from './selection-advanced.js';
import {prepareDrawing,type DrawingPlan} from './drawing.js';
export * from './drawing.js';
import {prepareCanvasGeometry,canvasGeometryLayers,type CanvasGeometryPlan} from './canvas-geometry.js';
import {prepareSelectionEffect,type SelectionEffectPlan} from './selection-effects.js';
export * from './selection-effects.js';
import {regenerateSelectionPaste,type SelectionPastePlan} from './selection-paste.js';
export * from './selection-paste.js';
import {prepareSelectionAction,type SelectionActionPlan} from './selection-actions.js';
export * from './selection-actions.js';
import {prepareSelectionPaint,type SelectionPaintPlan} from './selection-paint.js';
export * from './selection-paint.js';
export * from './canvas-geometry.js';
import {prepareAdjustment,type AdjustmentPlan} from './adjustments.js';
import {preparePaletteOperation,type PaletteOperationPlan} from './palette-organise.js';
export * from './palette-organise.js';
import {preparePaletteRamp,type PaletteRampPlan} from './palette-tools.js';
export * from './palette-tools.js';
export * from './adjustments.js';
import {clipAppendPlan} from './clips.js';
export * from './clips.js';
import {prepareTranslation,type TranslationPlan} from './tween.js';
export * from './tween.js';
import {validateReferences,type ReferenceState,type ReferenceImage} from './references.js';
export * from './references.js';
import {validateTags,type AnimationTag} from './animation.js';
export * from './animation.js';
import {layerEditable,descendantLayers,groupAncestors,layerForest,validateGroups,MAX_GROUPS,type LayerGroup} from './groups.js';
import {companionImportPlan} from './companion.js';
import {finishPixels} from './quick.js';
import { brushOffsets, type Brush } from './brush.js';
export * from './brush.js';
export * from './color.js';
import { linkedFrames,ensureCel,rasterCel,compactCel,encodeProject,composite, activeLayer, MAX_LAYERS, checkCelBudget,copyLayer,makeLayer,validatePaletteSlots,validateDuration, type Frame, type PixelDocument, type RGBA, type Layer } from './document.js';
import { shapePoints, transformSelection, validatePalette, type Shape, type Point, type Selection, type Transform } from './toolkit.js';
export * from './document.js';
export * from './conversion.js';
export * from './toolkit.js';
export * from './sheet.js';
export * from './tiles.js';
export * from './quick.js';
export type Delta = { index: number; before: number[]; after: number[] };
type LayerState = { width:number;height:number;conversion:PixelDocument['conversion'];layers: Layer[]; activeLayerId: string;frames:Frame[];activeFrameId:string;groups:LayerGroup[];tags:AnimationTag[] };
type Command = { bytes: number } & ({kind:'output';before:DocumentOutput;after:DocumentOutput}|{kind:'authored';before:AuthoredState;after:AuthoredState}|{kind:'references';before:ReferenceState;after:ReferenceState}|{ kind:'pixels'; layerId:string;frameId:string;frames:string[];buffer:Uint8ClampedArray;changes:Delta[] } | {kind:'bitmap';layerId:string;frameId:string;frames:string[];buffer:Uint8ClampedArray;before:Uint8ClampedArray;after:Uint8ClampedArray} | {kind:'layers'; before:LayerState; after:LayerState}|{kind:'palette';before:string[];after:string[]});
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
  applyDocumentOutput(plan:DocumentOutputPlan){this.commit();const fresh=regenerateDocumentOutput(this.document,plan,this.historyBudget);if(!fresh.changed)return false;const before=this.document.outputMode??'rgba';setDocumentOutput(this.document,fresh.mode);this.record({kind:'output',before,after:fresh.mode,bytes:fresh.historyBytes});return true;}
  applyAuthored(plan:AuthoredPlan){this.commit();const fresh=regenerateAuthored(this.document,plan,this.historyBudget);if(!fresh.plan.changed)return false;const before=authoredState(this.document);restoreAuthored(this.document,fresh.state);this.record({kind:'authored',before,after:authoredState(this.document),bytes:fresh.plan.historyBytes});return true;}
  applyLayerWorkflow(plan:LayerWorkflowPlan){this.commit();const fresh=regenerateLayerWorkflow(this.document,plan,this.historyBudget);if(!fresh.plan.changed)return false;return this.changeLayers(()=>{this.document.layers=fresh.layers;return true;});}
  applyStudio(plan:StudioPlan){this.commit();const fresh=regenerateStudio(this.document,plan,this.historyBudget);if(!fresh.changed)return false;return this.changeLayers(()=>{this.document.layers=fresh.layers;this.document.frames=fresh.frames;this.document.tags=fresh.tags;return true;});}
  private referenceState():ReferenceState {return {references:this.document.references.map(r=>({...r})),activeReferenceId:this.document.activeReferenceId};}
  private changeReferences(after:ReferenceState){this.commit();validateReferences(after);const before=this.referenceState();if(before.activeReferenceId===after.activeReferenceId&&before.references.length===after.references.length&&before.references.every((r,i)=>r.id===after.references[i].id&&r.name===after.references[i].name&&r.pixels===after.references[i].pixels&&JSON.stringify(r.placement)===JSON.stringify(after.references[i].placement)))return false;this.document.references=after.references;this.document.activeReferenceId=after.activeReferenceId;const buffers=new Set([...before.references,...after.references].map(r=>r.pixels));this.record({kind:'references',before,after,bytes:[...buffers].reduce((n,p)=>n+p.byteLength,0)+(before.references.length+after.references.length)*256});return true;}
  addReference(image:Omit<ReferenceImage,'id'>){let n=1;while(this.document.references.some(r=>r.id===`reference-${n}`))n++;const id=`reference-${n}`,reference={...image,id,name:image.name.trim()};validateReferences({references:[...this.document.references,reference],activeReferenceId:id});return this.changeReferences({references:[...this.document.references,{...reference,pixels:reference.pixels.slice()}],activeReferenceId:id});}
  applyReferenceTransform(plan:ReferenceTransformPlan){const fresh=regenerateReferenceTransform(this.document,plan,this.historyBudget);if(!fresh.changed)return false;const image=fresh.image;return this.changeReferences({references:this.document.references.map(r=>r.id===image.id?image:r),activeReferenceId:this.document.activeReferenceId});}
  selectReference(id:string){return this.changeReferences({references:this.document.references.slice(),activeReferenceId:id});}
  renameReference(id:string,name:string){if(!this.document.references.some(r=>r.id===id))throw new Error('Reference image is missing.');return this.changeReferences({references:this.document.references.map(r=>r.id===id?{...r,name:name.trim()}:r),activeReferenceId:this.document.activeReferenceId});}
  removeReference(id:string){if(!this.document.references.some(r=>r.id===id))throw new Error('Reference image is missing.');const references=this.document.references.filter(r=>r.id!==id);return this.changeReferences({references,activeReferenceId:this.document.activeReferenceId===id?references[0]?.id??null:this.document.activeReferenceId});}
  setPalette(colors:readonly string[]) {this.commit();const after=editingPalette(this.document,this.document.editingMode?validatePaletteSlots([...colors]):validatePalette(colors)),before=this.document.palette.slice();if(before.join()===after.join())return false;if(this.document.paletteOrganisation&&!before.every((c,i)=>after[i]===c))throw new Error('Use Authored studio palette organisation to preserve groups and locks.');this.document.palette=after;this.record({kind:'palette',before,after,bytes:(before.length+after.length)*64});return true;}
  applyPaletteRamp(plan:PaletteRampPlan){this.commit();if(!plan||plan.baseline!==encodeProject(this.document,false))throw new Error('Ramp source changed. Prepare again.');return this.setPalette(preparePaletteRamp(this.document,plan.options).colors);}
  applyPaletteOperation(plan:PaletteOperationPlan){this.commit();if(!plan||plan.baseline!==encodeProject(this.document,false))throw new Error('Palette source changed. Prepare again.');return this.setPalette(preparePaletteOperation(this.document,plan.options).colors);}
  applyCanvasGeometry(plan:CanvasGeometryPlan){
    this.commit();const doc=this.document;
    if(doc.indexed)return this.applyAuthored(indexedGeometryAuthored(doc,plan,this.historyBudget));
    if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Canvas source changed. Prepare again.');
    const fresh=prepareCanvasGeometry(doc,plan.options,this.historyBudget);if(!fresh.changed)return false;
    // Allocate only after validation/budget checks; mutation starts after every cel is ready.
    const layers=canvasGeometryLayers(doc,fresh),conversion=doc.conversion?{...doc.conversion,recipe:{...doc.conversion.recipe,width:fresh.width,height:fresh.height}}:undefined;
    return this.changeLayers(()=>{doc.width=fresh.width;doc.height=fresh.height;doc.layers=layers;if(conversion)doc.conversion=conversion;else delete doc.conversion;return true;});
  }
  shape(kind:Shape,a:Point,b:Point,color:RGBA,filled=false,brush:Brush={size:1,shape:'square'}) {const offsets=filled?[{x:0,y:0}]:brushOffsets(brush);for(const p of shapePoints(kind,a,b,filled))for(const d of offsets)this.paint(p.x+d.x,p.y+d.y,color);}
  applyCoverage(plan:CoveragePlan){this.commit();const doc=this.document,fresh=regenerateCoverage(doc,plan,this.historyBudget);if(!fresh.changedPixels)return false;const layer=activeLayer(doc),before=rasterCel(doc,layer).slice(),frames=linkedFrames(doc,layer),buffer=ensureCel(doc,layer);buffer.set(fresh.pixels);this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:fresh.pixels,bytes:fresh.historyBytes});compactCel(layer,doc.activeFrameId);return true;}
  applyDrawing(plan:DrawingPlan){
    this.commit();const doc=this.document;if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Drawing source changed. Start the stroke again.');
    const fresh=prepareDrawing(doc,plan.path,plan.options,this.historyBudget);if(!fresh.changedPixels)return false;
    const layer=activeLayer(doc),before=rasterCel(doc,layer).slice(),frames=linkedFrames(doc,layer),buffer=ensureCel(doc,layer);buffer.set(fresh.pixels);
    this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:fresh.pixels,bytes:fresh.historyBytes});compactCel(layer,doc.activeFrameId);return true;
  }
  applySelection(selection:Selection,options:Transform) {
    this.commit();const doc=this.document,layer=activeLayer(doc);
    if(doc.indexed)return this.applyAuthored(prepareIndexedSelection(doc,selection,options,this.historyBudget));
    if(layer.id!==selection.layerId||doc.activeFrameId!==selection.frameId||!layerEditable(doc,layer)||doc.width!==selection.canvasWidth||doc.height!==selection.canvasHeight||rasterCel(doc,layer).length!==selection.baseline.length||!rasterCel(doc,layer).every((v,i)=>v===selection.baseline[i]))throw new Error('The selected cel changed. Cancel and select its pixels again.');
    const pixels=transformSelection(selection,options),baseline=rasterCel(doc,layer);
    if(pixels.every((v,i)=>v===baseline[i]))return false;
    const frames=linkedFrames(doc,layer),bytes=3*pixels.byteLength+256+frames.length*64;
    if(bytes>this.historyBudget)throw new Error('Selection transform exceeds the undo memory budget.');
    const before=baseline.slice(),buffer=ensureCel(doc,layer);buffer.set(pixels);
    this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:pixels,bytes});compactCel(layer,doc.activeFrameId);return true;
  }
  applySelectionPaint(plan:SelectionPaintPlan){
    this.commit();const doc=this.document;
    if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Selection paint source changed. Prepare again.');
    const fresh=prepareSelectionPaint(doc,plan.rect,plan.options,this.historyBudget,plan.mask);if(!fresh.changedPixels)return false;
    const layer=activeLayer(doc),before=rasterCel(doc,layer).slice(),frames=linkedFrames(doc,layer),buffer=ensureCel(doc,layer);buffer.set(fresh.pixels);
    this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:fresh.pixels,bytes:fresh.historyBytes});compactCel(layer,doc.activeFrameId);return true;
  }
  applySelectionEffect(plan:SelectionEffectPlan){
    this.commit();const doc=this.document;if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Selection operation source changed. Prepare again.');
    const fresh=prepareSelectionEffect(doc,plan.rect,plan.options,this.historyBudget,plan.mask);if(!fresh.changedPixels)return false;
    const layer=activeLayer(doc),before=rasterCel(doc,layer).slice(),frames=linkedFrames(doc,layer),buffer=ensureCel(doc,layer);buffer.set(fresh.pixels);
    this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:fresh.pixels,bytes:fresh.historyBytes});compactCel(layer,doc.activeFrameId);return true;
  }
  applySelectionAction(plan:SelectionActionPlan){
    this.commit();const doc=this.document;
    if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Selection action source changed. Prepare again.');
    if(plan.options.kind==='export-png'||plan.options.kind==='export-project')throw new Error('Selection exports are download-only.');
    const fresh=prepareSelectionAction(doc,plan.rect,plan.options,this.historyBudget,plan.mask);if(!fresh.changed)return false;
    const layer=activeLayer(doc),frames=linkedFrames(doc,layer);
    if(fresh.options.kind==='clear'){
      const before=rasterCel(doc,layer).slice(),buffer=ensureCel(doc,layer);buffer.set(fresh.cleared);
      this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:fresh.cleared,bytes:fresh.historyBytes});compactCel(layer,doc.activeFrameId);return true;
    }
    const options=fresh.options;
    return this.changeLayers(()=>{
      let next=1;while(doc.layers.some(l=>l.id===`layer-${next}`))next++;const id=`layer-${next}`;
      const copied=fresh.pixels.some(v=>v!==0)?fresh.pixels:new Uint8ClampedArray(0),cels=Object.fromEntries(doc.frames.map(f=>[f.id,(f.id===doc.activeFrameId||options.kind==='cut-layer'&&frames.includes(f.id))?copied:new Uint8ClampedArray(0)]));
      if(options.kind==='cut-layer'){
        const source=copyLayer(doc,layer),cleared=fresh.cleared.some(v=>v!==0)?fresh.cleared:new Uint8ClampedArray(0);for(const frame of frames)source.cels[frame]=cleared;
        doc.layers[doc.layers.indexOf(layer)]=source;
      }
      const destination=makeLayer(doc,id,options.name,true,cels,{groupId:layer.groupId,opacity:layer.opacity,blendMode:layer.blendMode});
      doc.layers.splice(doc.layers.findIndex(l=>l.id===layer.id)+1,0,destination);doc.activeLayerId=id;return true;
    });
  }
  applySelectionPaste(plan:SelectionPastePlan){
    this.commit();const doc=this.document,fresh=regenerateSelectionPaste(doc,plan,this.historyBudget);if(!fresh.changed)return false;
    const layer=activeLayer(doc);
    if(fresh.options.destination==='cel'){
      const before=rasterCel(doc,layer).slice(),frames=linkedFrames(doc,layer),buffer=ensureCel(doc,layer);buffer.set(fresh.pixels);
      this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after:fresh.pixels,bytes:fresh.historyBytes});compactCel(layer,doc.activeFrameId);return true;
    }
    return this.changeLayers(()=>{let n=1;while(doc.layers.some(l=>l.id===`layer-${n}`))n++;const id=`layer-${n}`,pixels=fresh.pixels.some(v=>v!==0)?fresh.pixels:new Uint8ClampedArray(0),cels=Object.fromEntries(doc.frames.map(f=>[f.id,f.id===doc.activeFrameId?pixels:new Uint8ClampedArray(0)]));doc.layers.splice(doc.layers.indexOf(layer)+1,0,makeLayer(doc,id,fresh.options.name,true,cels,{groupId:layer.groupId}));doc.activeLayerId=id;return true;});
  }
  finishArtwork(kind:'outline'|'speckles',color:RGBA) {this.commit();const doc=this.document,layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer before finishing.');const before=rasterCel(doc,layer),next=finishPixels({width:doc.width,height:doc.height,pixels:before},kind,color);for(let p=0;p<next.length;p+=4)if(next[p]!==before[p]||next[p+1]!==before[p+1]||next[p+2]!==before[p+2]||next[p+3]!==before[p+3])this.paint(p/4%doc.width,Math.floor(p/4/doc.width),[next[p],next[p+1],next[p+2],next[p+3]]);return this.commit();}
  selectLayer(id:string) { this.commit(); if(!this.document.layers.some(l=>l.id===id))throw new Error('Layer is missing.');this.document.activeLayerId=id; }
  applyAdjustment(plan:AdjustmentPlan){this.commit();const doc=this.document;if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Adjustment source changed. Prepare the preview again.');const fresh=prepareAdjustment(doc,plan.options);if(!fresh.changedPixels)return false;const layer=activeLayer(doc),before=rasterCel(doc,layer).slice(),frames=linkedFrames(doc,layer),buffer=ensureCel(doc,layer),after=fresh.pixels;buffer.set(after);this.record({kind:'bitmap',layerId:layer.id,frameId:doc.activeFrameId,frames,buffer,before,after,bytes:before.byteLength+after.byteLength+buffer.byteLength+256+frames.length*64});compactCel(layer,doc.activeFrameId);return true;}
  importLayer(source:PixelDocument) {
    const plan=companionImportPlan(this.document,source,'layer');
    return this.changeLayers(()=>{const doc=this.document;let next=1;while(doc.layers.some(l=>l.id===`layer-${next}`))next++;const id=`layer-${next}`;
      const cels=Object.fromEntries(doc.frames.map(f=>[f.id,f.id===doc.activeFrameId?editingPixels(doc,plan.pixels!):new Uint8ClampedArray(0)]));
      doc.layers.splice(doc.layers.indexOf(activeLayer(doc))+1,0,makeLayer(doc,id,plan.name!,true,cels,{groupId:activeLayer(doc).groupId}));doc.activeLayerId=id;return true;});
  }
  selectFrame(id:string) {this.commit();if(!this.document.frames.some(f=>f.id===id))throw new Error('Frame is missing.');this.document.activeFrameId=id;}
  addFrame(duplicate=false) {
    const doc=this.document;checkCelBudget(doc.width,doc.height,doc.layers.length,doc.frames.length+1);
    return this.changeLayers(()=>{let next=1;while(doc.frames.some(f=>f.id===`frame-${next}`))next++;const id=`frame-${next}`,index=doc.frames.findIndex(f=>f.id===doc.activeFrameId),current=doc.frames[index];
      for(const layer of doc.layers)layer.cels[id]=duplicate?layer.cels[doc.activeFrameId].slice():new Uint8ClampedArray(0);
      doc.tags=doc.tags.map(t=>({...t,from:t.from>index?t.from+1:t.from,to:t.to>index?t.to+1:t.to}));doc.frames.splice(index+1,0,{id,duration:duplicate?current.duration:100});doc.activeFrameId=id;return true;});
  }
  deleteFrame() {if(this.document.frames.length===1)throw new Error('Keep at least one frame.');return this.changeLayers(()=>{const doc=this.document,index=doc.frames.findIndex(f=>f.id===doc.activeFrameId);for(const l of doc.layers)delete l.cels[doc.activeFrameId];doc.tags=doc.tags.filter(t=>t.from!==index||t.to!==index).map(t=>({...t,from:t.from>index?t.from-1:t.from,to:t.to>=index?t.to-1:t.to}));doc.frames.splice(index,1);doc.activeFrameId=doc.frames[Math.min(index,doc.frames.length-1)].id;return true;});}
  reorderFrame(from:number,to:number){if(![from,to].every(n=>Number.isInteger(n)&&n>=0&&n<this.document.frames.length))throw new Error('Invalid frame order.');if(from===to)return false;return this.changeLayers(()=>{const [frame]=this.document.frames.splice(from,1);this.document.frames.splice(to,0,frame);return true;});}
  moveFrame(direction:1|-1) {return this.changeLayers(()=>{const doc=this.document,i=doc.frames.findIndex(f=>f.id===doc.activeFrameId),next=i+direction;if(next<0||next>=doc.frames.length)return false;[doc.frames[i],doc.frames[next]]=[doc.frames[next],doc.frames[i]];return true;});}
  appendClip(text:string){this.commit();const doc=this.document,clip=clipAppendPlan(doc,text);return this.changeLayers(()=>{const start=doc.frames.length,used=new Set(doc.frames.map(f=>f.id));let n=1;const frames=clip.frames.map(f=>{while(used.has(`frame-${n}`))n++;const id=`frame-${n}`;used.add(id);return {id,duration:f.duration};});let layerNumber=1;while(doc.layers.some(l=>l.id===`layer-${layerNumber}`))layerNumber++;const cels:Record<string,Uint8ClampedArray>=Object.fromEntries(doc.frames.map(f=>[f.id,new Uint8ClampedArray(0)]));for(let i=0;i<frames.length;i++){const id=frames[i].id;cels[id]=clip.layers[0].cels[clip.frames[i].id].slice();for(const l of doc.layers)l.cels[id]=new Uint8ClampedArray(0);}const layer=makeLayer(doc,`layer-${layerNumber}`,clip.name,true,cels);doc.layers.push(layer);doc.frames.push(...frames);doc.activeLayerId=layer.id;doc.activeFrameId=frames[0].id;if(clip.tags.length){let number=1;while(doc.tags.some(t=>t.id===`tag-${number}`))number++;const source=clip.tags[0],base=source.name.slice(0,70);let name=source.name,suffix=2;while(doc.tags.some(t=>t.name.toLowerCase()===name.toLowerCase()))name=`${base} (${suffix++})`;doc.tags.push({id:`tag-${number}`,name,from:start,to:start+frames.length-1,mode:source.mode});}return true;});}
  applyTranslation(plan:TranslationPlan){this.commit();const doc=this.document;if(!plan||plan.baseline!==encodeProject(doc,false))throw new Error('Tween source changed. Prepare the preview again.');const fresh=prepareTranslation(doc,plan.options);return this.changeLayers(()=>{const at=doc.frames.findIndex(f=>f.id===doc.activeFrameId),used=new Set(doc.frames.map(f=>f.id));let n=1;const frames=fresh.frames.map(cels=>{while(used.has(`frame-${n}`))n++;const id=`frame-${n}`;used.add(id);for(const layer of doc.layers)layer.cels[id]=cels[layer.id];return {id,duration:fresh.options.duration};});doc.tags=doc.tags.map(t=>({...t,from:t.from>at?t.from+frames.length:t.from,to:t.to>at?t.to+frames.length:t.to}));doc.frames.splice(at+1,0,...frames);doc.activeFrameId=frames.at(-1)!.id;return true;});}
  clearCel(){this.commit();const doc=this.document,layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer before clearing its cel.');if(!layer.cels[doc.activeFrameId].length)return false;const frames=linkedFrames(doc,layer);return this.changeLayers(()=>{const empty=new Uint8ClampedArray(0);for(const id of frames)layer.cels[id]=empty;return true;});}
  linkCel(sourceFrameId:string){this.commit();const doc=this.document,layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer before linking cels.');if(!doc.frames.some(f=>f.id===sourceFrameId))throw new Error('Source frame is missing.');if(layer.cels[doc.activeFrameId]===layer.cels[sourceFrameId])return false;return this.changeLayers(()=>{layer.cels[doc.activeFrameId]=layer.cels[sourceFrameId];return true;});}
  unlinkCel(){this.commit();const doc=this.document,layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer before unlinking cels.');if(linkedFrames(doc,layer).length<2)return false;return this.changeLayers(()=>{layer.cels[doc.activeFrameId]=layer.cels[doc.activeFrameId].slice();return true;});}
  setFrameDuration(duration:number) {validateDuration(duration);return this.changeLayers(()=>{const f=this.document.frames.find(f=>f.id===this.document.activeFrameId)!;if(f.duration===duration)return false;f.duration=duration;return true;});}
  setTag(value:Omit<AnimationTag,'id'>,id?:string) {
    const doc=this.document;if(id&&!doc.tags.some(t=>t.id===id))throw new Error('Tag is missing.');
    let n=1;while(doc.tags.some(t=>t.id===`tag-${n}`))n++;const tag={...value,name:value.name.trim(),id:id??`tag-${n}`};
    const tags=id?doc.tags.map(t=>t.id===id?tag:{...t}):[...doc.tags,tag];validateTags({...doc,tags});
    if(JSON.stringify(tags)===JSON.stringify(doc.tags))return false;
    return this.changeLayers(()=>{doc.tags=tags;return true;});
  }
  deleteTag(id:string) {if(!this.document.tags.some(t=>t.id===id))throw new Error('Tag is missing.');return this.changeLayers(()=>{this.document.tags=this.document.tags.filter(t=>t.id!==id);return true;});}
  private layerState():LayerState {const doc=this.document;return {width:doc.width,height:doc.height,conversion:doc.conversion,layers:doc.layers.map(l=>copyLayer(doc,l)),activeLayerId:doc.activeLayerId,frames:doc.frames.map(f=>({...f})),activeFrameId:doc.activeFrameId,groups:doc.groups.map(g=>({...g})),tags:doc.tags.map(t=>({...t}))}; }
  private restore(state:LayerState) {const doc=this.document;doc.width=state.width;doc.height=state.height;if(state.conversion)doc.conversion=state.conversion;else delete doc.conversion;doc.tags=state.tags.map(t=>({...t}));doc.groups=state.groups.map(g=>({...g}));doc.frames=state.frames.map(f=>({...f}));doc.activeFrameId=state.activeFrameId;doc.layers=state.layers.map(l=>copyLayer(doc,l));doc.activeLayerId=state.activeLayerId; }
  private record(command:Command) {
    try{validateTilemapLayers(this.document);validateIndexedDocument(this.document);validateEditingPolicy(this.document);}catch(error){this.restoreCommand(command,'before');throw error;}
    this.bytes-=this.redoStack.reduce((n,c)=>n+c.bytes,0);this.redoStack=[];
    this.undoStack.push(command);this.bytes+=command.bytes;
    while(this.bytes>this.historyBudget||this.undoStack.length>100){this.bytes-=this.undoStack.shift()!.bytes;this.evicted=true;}
  }
  private changeLayers(change:()=>boolean) {
    this.commit();const before=this.layerState();if(!change())return false;const after=this.layerState();
    // Snapshots share pixel buffers; budget counts every buffer retained by a command.
    const buffers=new Set<Uint8Array|Uint8ClampedArray|Int16Array>([...tilemapBuffers([...before.layers,...after.layers]),...[...before.layers,...after.layers].flatMap(l=>[...Object.values(l.cels),...(l.mask?[l.mask.values]:[])])]);
    this.record({kind:'layers',before,after,bytes:[...buffers].reduce((n,p)=>n+p.byteLength,0)+[...before.layers,...after.layers].reduce((n,l)=>n+(l.effects?.length??0)*128+(l.text?1024:0),0)+[...before.groups,...after.groups].reduce((n,g)=>n+(g.effects?.length??0)*128,0)+(before.layers.length+after.layers.length+before.frames.length+after.frames.length+before.groups.length+after.groups.length+before.tags.length+after.tags.length)*256});return true;
  }
  addLayer(duplicate=false) {
    if(this.document.layers.length>=MAX_LAYERS)throw new Error('A project supports at most 16 layers.');
    checkCelBudget(this.document.width,this.document.height,this.document.layers.length+1,this.document.frames.length);
    return this.changeLayers(()=>{const doc=this.document,current=activeLayer(doc);let next=1;while(doc.layers.some(l=>l.id===`layer-${next}`))next++;const id=`layer-${next}`;
      const clones=new Map<Uint8ClampedArray,Uint8ClampedArray>();const clone=(p:Uint8ClampedArray)=>{if(!clones.has(p))clones.set(p,p.slice());return clones.get(p)!;};
      const layer=makeLayer(doc,id,duplicate?`${current.name.slice(0,70)} copy`:`Layer ${doc.layers.length+1}`,true,Object.fromEntries(doc.frames.map(f=>[f.id,duplicate?clone(current.cels[f.id]):new Uint8ClampedArray(0)])));
      doc.layers.splice(doc.layers.indexOf(current)+1,0,layer);doc.activeLayerId=id;layer.groupId=current.groupId;if(duplicate){layer.locked=current.locked;layer.opacity=current.opacity;layer.blendMode=current.blendMode;if(current.mask)layer.mask={...current.mask,values:current.mask.values.slice()};if(current.effects)layer.effects=current.effects.map(e=>({...e}));if(current.tilemap)layer.tilemap=copyTilemap(current.tilemap);if(current.text)layer.text=structuredClone(current.text);if(current.adjustment)layer.adjustment=true;}return true;});
  }
  deleteLayer() {
    if(this.document.layers.length===1)throw new Error('Keep at least one layer.');
    return this.groupOperation(doc=>{const index=doc.layers.findIndex(l=>l.id===doc.activeLayerId);doc.layers.splice(index,1);doc.activeLayerId=doc.layers[Math.min(index,doc.layers.length-1)].id;});
  }
  renameLayer(name:string) { const clean=name.trim();if(!clean||clean.length>80)throw new Error('Layer names need 1–80 characters.');return this.changeLayers(()=>{const layer=activeLayer(this.document);if(layer.name===clean)return false;layer.name=clean;return true;}); }
  private groupOperation(change:(doc:PixelDocument)=>void){
    this.commit();const doc=this.document,draft={...doc,layers:doc.layers.map(l=>copyLayer(doc,l)),groups:doc.groups.map(g=>({...g})),tags:doc.tags.map(t=>({...t}))};change(draft);validateGroups(draft);
    return this.changeLayers(()=>{doc.layers=draft.layers.map(l=>copyLayer(doc,l));doc.groups=draft.groups.map(g=>({...g}));doc.activeLayerId=draft.activeLayerId;return true;});
  }
  createGroup(around=this.document.activeLayerId){
    if(this.document.groups.length>=MAX_GROUPS)throw new Error('Projects support at most 16 groups.');
    return this.groupOperation(doc=>{const layer=doc.layers.find(l=>l.id===around),group=doc.groups.find(g=>g.id===around);if(!layer&&!group)throw new Error('Choose a layer or group to wrap.');let n=1;while(doc.groups.some(g=>g.id===`group-${n}`))n++;const id=`group-${n}`,parentId=layer?layer.groupId:group!.parentId;doc.groups.push({id,name:`Group ${n}`,parentId,visible:true,locked:false,opacity:255});if(layer)layer.groupId=id;else group!.parentId=id;});
  }
  setGroupProperties(id:string,patch:Partial<Pick<LayerGroup,'name'|'visible'|'locked'|'opacity'>>){
    if(Object.keys(patch).some(k=>!['name','visible','locked','opacity'].includes(k)))throw new Error('Unsupported group property.');
    const group=this.document.groups.find(g=>g.id===id);if(!group)throw new Error('Group is missing.');if(Object.entries(patch).every(([k,v])=>group[k as keyof LayerGroup]===v))return false;
    return this.groupOperation(doc=>Object.assign(doc.groups.find(g=>g.id===id)!,patch));
  }
  ungroup(id:string){return this.groupOperation(doc=>{const g=doc.groups.find(g=>g.id===id);if(!g)throw new Error('Group is missing.');if(g.effects?.length)throw new Error('Remove group live effects or flatten before ungrouping.');if(!g.visible||g.locked||g.opacity!==255)throw new Error('Show, unlock and set group opacity to 100% before ungrouping.');if(descendantLayers(doc,id).some(l=>l.blendMode!=='normal'))throw new Error('Set descendant layer blends to Normal before ungrouping; isolation changes their backdrop.');for(const l of doc.layers)if(l.groupId===id)l.groupId=g.parentId;for(const child of doc.groups)if(child.parentId===id)child.parentId=g.parentId;doc.groups=doc.groups.filter(g=>g.id!==id);});}
  deleteGroup(id:string){return this.groupOperation(doc=>{if(!doc.groups.some(g=>g.id===id))throw new Error('Group is missing.');const leaves=new Set(descendantLayers(doc,id).map(l=>l.id)),groups=new Set(doc.groups.filter(g=>groupAncestors(doc,g.id).some(a=>a.id===id)).map(g=>g.id));if(leaves.size===doc.layers.length)throw new Error('Keep at least one artwork layer.');doc.layers=doc.layers.filter(l=>!leaves.has(l.id));doc.groups=doc.groups.filter(g=>!groups.has(g.id));if(leaves.has(doc.activeLayerId))doc.activeLayerId=doc.layers.at(-1)!.id;});}
  moveIntoGroup(nodeId:string,parentId:string|null){
    const doc=this.document,layer=doc.layers.find(l=>l.id===nodeId),group=doc.groups.find(g=>g.id===nodeId);if(!layer&&!group)throw new Error('Layer or group is missing.');if((layer?layer.groupId:group!.parentId)===parentId)return false;
    return this.groupOperation(draft=>{if(parentId!==null&&!draft.groups.some(g=>g.id===parentId))throw new Error('Destination group is missing.');if(group&&parentId!==null&&groupAncestors(draft,parentId).some(g=>g.id===nodeId))throw new Error('A group cannot contain itself or its descendants.');
      const moving=layer?draft.layers.filter(l=>l.id===nodeId):descendantLayers(draft,nodeId),ids=new Set(moving.map(l=>l.id));draft.layers=draft.layers.filter(l=>!ids.has(l.id));
      const at=parentId===null?draft.layers.length:Math.max(...descendantLayers(draft,parentId).map(l=>draft.layers.indexOf(l)))+1;
      if(layer)moving[0].groupId=parentId;else draft.groups.find(g=>g.id===nodeId)!.parentId=parentId;draft.layers.splice(at,0,...moving);
    });
  }
  moveNode(id:string,direction:1|-1){
    const doc=this.document,layer=doc.layers.find(l=>l.id===id),group=doc.groups.find(g=>g.id===id);if(!layer&&!group)throw new Error('Layer or group is missing.');const siblings=layerForest(doc,layer?layer.groupId:group!.parentId),at=siblings.findIndex(n=>n.id===id),next=at+direction;if(next<0||next>=siblings.length)return false;
    const a=siblings[at],b=siblings[next],leaves=(node:typeof a)=>node.group?descendantLayers(doc,node.id):doc.layers.filter(l=>l.id===node.id),one=leaves(a),two=leaves(b),start=Math.min(doc.layers.indexOf(one[0]),doc.layers.indexOf(two[0]));
    return this.groupOperation(draft=>{const ids=new Map(draft.layers.map(l=>[l.id,l]));draft.layers.splice(start,one.length+two.length,...(direction===1?[...two,...one]:[...one,...two]).map(l=>ids.get(l.id)!));});
  }
  toggleLayerLock(){return this.changeLayers(()=>{const l=activeLayer(this.document);l.locked=!l.locked;return true;});}
  setLayerOpacity(opacity:number){if(!Number.isInteger(opacity)||opacity<0||opacity>255)throw new Error('Opacity must be 0-255 whole units.');return this.changeLayers(()=>{const l=activeLayer(this.document);if(l.opacity===opacity)return false;l.opacity=opacity;return true;});}
  setLayerBlendMode(mode:BlendMode){validateBlendMode(mode);return this.changeLayers(()=>{const layer=activeLayer(this.document);if(layer.blendMode===mode)return false;if(layer.adjustment&&mode!=='normal')throw new Error('Adjustment layers require Normal blend.');layer.blendMode=mode;return true;});}
  private batchLayers(ids:readonly string[]){
    if(!Array.isArray(ids)||!ids.length||ids.length>MAX_LAYERS||new Set(ids).size!==ids.length||ids.some(id=>!this.document.layers.some(l=>l.id===id)))throw new Error('Select distinct existing artwork layers.');
    const selected=new Set(ids);return this.document.layers.filter(l=>selected.has(l.id));
  }
  /** Metadata applies to precisely the checked leaves, regardless of ancestor locks. */
  setLayersProperties(ids:readonly string[],patch:Partial<Pick<Layer,'visible'|'locked'|'opacity'|'blendMode'>>){
    const layers=this.batchLayers(ids);
    if(!patch||Object.keys(patch).some(k=>!['visible','locked','opacity','blendMode'].includes(k)))throw new Error('Unsupported batch layer property.');
    for(const key of ['visible','locked'] as const)if(key in patch&&typeof patch[key]!=='boolean')throw new Error('Layer flags must be boolean.');
    if('opacity' in patch&&(!Number.isInteger(patch.opacity)||patch.opacity!<0||patch.opacity!>255))throw new Error('Opacity must be 0-255 whole units.');
    if('blendMode' in patch){validateBlendMode(patch.blendMode);if(patch.blendMode!=='normal'&&ids.some(id=>this.document.layers.find(l=>l.id===id)?.adjustment))throw new Error('Adjustment layers require Normal blend.');}
    if(layers.every(l=>Object.entries(patch).every(([k,v])=>l[k as keyof Layer]===v)))return false;
    return this.groupOperation(doc=>{for(const layer of doc.layers)if(ids.includes(layer.id))Object.assign(layer,patch);});
  }
  duplicateLayers(ids:readonly string[]){
    const layers=this.batchLayers(ids),doc=this.document;checkCelBudget(doc.width,doc.height,doc.layers.length+layers.length,doc.frames.length);
    return this.groupOperation(draft=>{let next=1;for(const source of layers){while(draft.layers.some(l=>l.id===`layer-${next}`))next++;const copies=new Map<Uint8ClampedArray,Uint8ClampedArray>(),cels=Object.fromEntries(doc.frames.map(f=>{const pixels=source.cels[f.id];if(!copies.has(pixels))copies.set(pixels,pixels.slice());return [f.id,copies.get(pixels)!];}));const copy=makeLayer(doc,`layer-${next}`,`${source.name.slice(0,70)} copy`,source.visible,cels,source);if(copy.mask)copy.mask={...copy.mask,values:copy.mask.values.slice()};draft.layers.splice(draft.layers.findIndex(l=>l.id===source.id)+1,0,copy);}});
  }
  deleteLayers(ids:readonly string[]){
    const layers=this.batchLayers(ids);if(layers.length===this.document.layers.length)throw new Error('Keep at least one artwork layer.');
    return this.groupOperation(doc=>{const oldIndex=doc.layers.findIndex(l=>l.id===doc.activeLayerId);doc.layers=doc.layers.filter(l=>!ids.includes(l.id));const empty=doc.groups.filter(g=>!descendantLayers(doc,g.id).length).map(g=>g.id);doc.groups=doc.groups.filter(g=>!empty.includes(g.id));if(ids.includes(doc.activeLayerId))doc.activeLayerId=doc.layers[Math.min(oldIndex,doc.layers.length-1)].id;});
  }
  groupLayers(ids:readonly string[]){
    const layers=this.batchLayers(ids),doc=this.document,parentId=layers[0].groupId;
    if(doc.groups.length>=MAX_GROUPS)throw new Error('Projects support at most 16 groups.');
    const first=doc.layers.indexOf(layers[0]),last=doc.layers.indexOf(layers.at(-1)!);
    if(layers.some(l=>l.groupId!==parentId)||last-first+1!==layers.length)throw new Error('Select a contiguous run of sibling layers to group.');
    return this.groupOperation(draft=>{let n=1;while(draft.groups.some(g=>g.id===`group-${n}`))n++;const id=`group-${n}`;draft.groups.push({id,name:`Group ${n}`,parentId,visible:true,locked:false,opacity:255});for(const layer of draft.layers)if(ids.includes(layer.id))layer.groupId=id;});
  }
  moveLayers(ids:readonly string[],direction:1|-1){
    const layers=this.batchLayers(ids),doc=this.document,parent=layers[0].groupId;
    if(direction!==1&&direction!==-1)throw new Error('Choose a layer move direction.');
    if(layers.some(l=>l.groupId!==parent))throw new Error('Select sibling layers to move together.');
    const siblings=layerForest(doc,parent),selected=new Set(ids),ordered=siblings.slice();let changed=false;
    const start=direction===1?ordered.length-2:1,end=direction===1?-1:ordered.length,step=direction===1?-1:1;
    for(let i=start;i!==end;i+=step){const j=i+direction;if(selected.has(ordered[i].id)&&!selected.has(ordered[j].id)){[ordered[i],ordered[j]]=[ordered[j],ordered[i]];changed=true;}}
    if(!changed)return false;
    const leaves=ordered.flatMap(n=>n.group?descendantLayers(doc,n.id):doc.layers.filter(l=>l.id===n.id)),first=Math.min(...leaves.map(l=>doc.layers.indexOf(l)));
    return this.groupOperation(draft=>{const byId=new Map(draft.layers.map(l=>[l.id,l]));draft.layers.splice(first,leaves.length,...leaves.map(l=>byId.get(l.id)!));});
  }
  mergeDown(){const doc=this.document,at=doc.layers.indexOf(activeLayer(doc)),top=doc.layers[at],bottom=doc.layers[at-1];
    if(!bottom)throw new Error('Select a layer above another layer.');if(top.groupId!==bottom.groupId||!layerEditable(doc,top)||!layerEditable(doc,bottom))throw new Error('Show and unlock both layers before merging.');
    if(top.text||top.adjustment||top.tilemap||bottom.text||bottom.adjustment||bottom.tilemap)throw new Error('Rasterize text or flatten adjustment layers before merging.');
    if(top.mask||bottom.mask||top.effects?.length||bottom.effects?.length)throw new Error('Bake layer masks and live effects before merging.');
    if(top.blendMode!=='normal'||bottom.blendMode!=='normal')throw new Error('Set both layers to Normal before merging. Blends depend on the full backdrop; use flattened export to bake the appearance.');
    const cels=Object.fromEntries(doc.frames.map(f=>[f.id,composite({...doc,layers:[bottom,top],groups:[]},f.id)]));
    return this.changeLayers(()=>{doc.layers.splice(at-1,2,makeLayer(doc,bottom.id,bottom.name,true,cels,{groupId:bottom.groupId}));doc.activeLayerId=bottom.id;return true;});
  }
  toggleLayer() {return this.changeLayers(()=>{const layer=activeLayer(this.document);layer.visible=!layer.visible;return true;});}
  moveLayer(direction:1|-1) {return this.moveNode(this.document.activeLayerId,direction);}
  paint(x: number, y: number, color: RGBA, mirrorX = false, mirrorY = false) {
    if(this.document.indexed)return; // Index-preserving edits use staged Indexed studio operations.
    color=editingInk(this.document,color);
    if(!layerEditable(this.document,activeLayer(this.document)))return;
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
    if(!layerEditable(this.document,activeLayer(this.document)))return;
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
    if (!changes.length){compactCel(activeLayer(this.document),this.document.activeFrameId);return false;}
    if(changes.length>1024&&changes.length*512>this.document.cel.pixels.byteLength*2+256){
      const after=this.document.cel.pixels.slice(),before=after.slice();for(const d of changes)before.set(d.before,d.index);
      this.record({kind:'bitmap',layerId:this.document.activeLayerId,frameId:this.document.activeFrameId,frames:linkedFrames(this.document,activeLayer(this.document)),buffer:this.document.cel.pixels,before,after,bytes:before.byteLength+after.byteLength+this.document.cel.pixels.byteLength+256+linkedFrames(this.document,activeLayer(this.document)).length*64});
    }else this.record({kind:'pixels',layerId:this.document.activeLayerId,frameId:this.document.activeFrameId,frames:linkedFrames(this.document,activeLayer(this.document)),buffer:this.document.cel.pixels,changes,bytes:changes.length*512+this.document.cel.pixels.byteLength+linkedFrames(this.document,activeLayer(this.document)).length*64});
    compactCel(activeLayer(this.document),this.document.activeFrameId);return true;
  }
  private restoreCommand(command:Command,side:'before'|'after'){
    if(command.kind==='output')setDocumentOutput(this.document,command[side]);
    else if(command.kind==='authored')restoreAuthored(this.document,command[side]);
    else if(command.kind==='references'){this.document.references=command[side].references.map(r=>({...r}));this.document.activeReferenceId=command[side].activeReferenceId;}
    else if(command.kind==='palette')this.document.palette=command[side].slice();
    else if(command.kind==='layers')this.restore(command[side]);
    else if(command.kind==='bitmap'){const layer=this.document.layers.find(l=>l.id===command.layerId)!;this.document.activeLayerId=layer.id;this.document.activeFrameId=command.frameId;for(const id of command.frames)layer.cels[id]=command.buffer;layer.pixels.set(command[side]);}
    else {const layer=this.document.layers.find(l=>l.id===command.layerId)!;this.document.activeLayerId=layer.id;this.document.activeFrameId=command.frameId;for(const id of command.frames)layer.cels[id]=command.buffer;for(const d of command.changes)layer.pixels.set(d[side],d.index);}
  }
  undo() {
    const command = this.undoStack.pop(); if (!command) return false;
    this.restoreCommand(command,'before');
    if(command.kind==='pixels'||command.kind==='bitmap')compactCel(activeLayer(this.document),this.document.activeFrameId);
    this.redoStack.push(command); return true;
  }
  redo() {
    const command = this.redoStack.pop(); if (!command) return false;
    this.restoreCommand(command,'after');
    if(command.kind==='pixels'||command.kind==='bitmap')compactCel(activeLayer(this.document),this.document.activeFrameId);
    this.undoStack.push(command); return true;
  }
}

export * from './native-aseprite.js';
export * from './native-piskel.js';
export {MAX_NATIVE_BYTES} from './native-utils.js';
export * from './native-ora.js';
export * from './native-psd.js';
export * from './layer-exchange.js';

export * from './companion.js';

export * from './groups.js';
export * from './palette-exchange.js';
export * from './native-gif.js';
export * from './raster-exchange.js';

export * from './legacy-raster.js';
export * from './native-icon.js';
export * from './native-apng.js';

export * from './png-modes.js';

export * from './indexed-tools.js';

export * from './focus.js';

export * from './large-canvas.js';
export * from './large-mask.js';
export * from './large-transform.js';

export * from './large-layer-mask.js';

export * from './large-mask-authoring.js';

export * from './large-mask-timeline.js';

export * from './large-indexed.js';

export {PALETTE_PRESETS,type PalettePreset} from './palette-presets.js';

export * from './focus-selection.js';
