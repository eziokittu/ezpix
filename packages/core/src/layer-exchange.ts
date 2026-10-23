import {nativeMetadataWarnings} from './authored-metadata.js';
import {hasLinkedCels,makeLayer,checkCelBudget,decodeProject,encodeProject,type PixelDocument} from './document.js';
import {fail} from './native-utils.js';
export type LayerExportMode='selected-frame'|'frames-as-layers';
/** Both static formats export either the selected frame's layers or flattened animation frames. */
export function layerExportSnapshot(source:PixelDocument,mode:LayerExportMode){
 const doc=decodeProject(encodeProject(source,false));
 if(!['selected-frame','frames-as-layers'].includes(mode))fail('Choose a layered export mode.');
 const warnings=['Static layered file: reference images, animation timing/tags/playback modes, palette swatches, conversion source/recipe and undo history are not included.'];
 warnings.push(...nativeMetadataWarnings(doc));
 if(hasLinkedCels(doc))warnings.push('Linked cels are expanded; shared edit identity is omitted.');
 if(doc.layers.some(l=>l.locked))warnings.push('Layer edit locks are omitted in this native format.');
 if(doc.groups.length&&mode==='selected-frame')fail('Native layered group export is unsupported. Choose animation frames as flattened layers, PNG or EzPix.');
 if(mode==='selected-frame'&&doc.layers.some(l=>l.text||l.adjustment||l.mask||l.effects?.length))fail('Layer masks/live effects require baking or frames as flattened layers.');
 if(mode==='selected-frame'&&doc.layers.some(l=>l.blendMode!=='normal'))fail('Native layered blend export is unsupported. Choose animation frames as flattened layers, PNG or EzPix.');
 if(mode==='selected-frame'){
  if(doc.frames.length>1)warnings.push(`Only selected frame ${doc.frames.findIndex(f=>f.id===doc.activeFrameId)+1} is exported.`);
  const id=doc.activeFrameId;doc.layers=doc.layers.map(l=>makeLayer(doc,l.id,l.name,l.visible,{'frame-1':l.cels[id].slice()},l));
 }else{
  checkCelBudget(doc.width,doc.height,doc.frames.length,1);warnings.push('Each animation frame becomes one flattened visible layer; original hidden pixels and layer structure are omitted.');
  const frames=doc.frames.map((f,i)=>({name:`Frame ${i+1} (${f.duration} ms)`,pixels:compositeFrame(doc,f.id)}));doc.layers=frames.map((f,i)=>makeLayer(doc,`layer-${i+1}`,f.name,true,{'frame-1':f.pixels}));
 }
 doc.groups=[];doc.tags=[];
 doc.frames=[{id:'frame-1',duration:100}];doc.activeFrameId='frame-1';doc.activeLayerId=doc.layers.at(-1)!.id;return {document:doc,warnings};
}
import {composite as compositeFrame} from './document.js';
