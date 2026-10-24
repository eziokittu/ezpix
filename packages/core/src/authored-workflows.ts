import {indexedGeometryOperation,type IndexedGeometryOperation} from './indexed-geometry.js';
import {indexedSelectionOperation,type IndexedSelectionOperation} from './indexed-selection.js';
import {indexedToolOperation,type IndexedToolOperation} from './indexed-tools.js';
import {copyIndexedDocument,indexedOperation,importIndexedCel,validateIndexedDocument,type IndexedOperation} from './indexed-document.js';
import {decodeIndexedCel,expandIndexedCel} from './indexed-cel.js';
import {editingPixels,editingInk,editingPalette} from './editing-policy.js';
import {referenceDisplay} from './reference-overlay.js';
import {copyLayer,encodeProject,composite,makeLayer,checkCelBudget,decodeProject,validatePaletteSlots,type PixelDocument,type Layer,type Frame} from './document.js';
import {sourceGrayscale,transferDocument} from './document-workflows.js';
import {groupAncestors,validateGroups,type LayerGroup} from './groups.js';
import {validateReferences,type ReferenceImage} from './references.js';
import {validatePlacement,validateAuthoredMetadata,type ReferencePlacement,type PaletteOrganisation,type SpriteSlice} from './authored-metadata.js';
import {validateBitmapText,renderBitmapText,type BitmapText} from './bitmap-text.js';
import {validateLiveEffects,type LiveEffect} from './layer-render.js';
import {validatePalette} from './toolkit.js';
export type PaletteEdit={action:'add-group';name:string}|{action:'rename-group';id:string;name:string}|{action:'remove-group';id:string}|{action:'assign';index:number;id:string|null}|{action:'lock';index:number;locked:boolean}|{action:'replace';index:number;color:string}|{action:'add';color:string}|{action:'remove';index:number}|{action:'move';index:number;to:number}|{action:'clear-organisation'};
export type AuthoredOperation=IndexedOperation|IndexedToolOperation|IndexedGeometryOperation|IndexedSelectionOperation
 |{kind:'indexed-cel';text:string;destination:'layer'|'cel'}
 |{kind:'reference-placement';id:string;placement:ReferencePlacement}
 |{kind:'text';id?:string;name:string;text:BitmapText}
 |{kind:'rasterize-text';id:string}
 |{kind:'adjustment';name:string;effects:LiveEffect[]}
 |{kind:'layer-effects';id:string;effects:LiveEffect[]}
 |{kind:'group-effects';id:string;effects:LiveEffect[]}
 |{kind:'editing-policy';mode:'rgba'|'grayscale'}|{kind:'source-grayscale'}|{kind:'document-transfer';project:string;destination:'layer'|'frames'|'palette'|'reference'}|{kind:'flatten'}|{kind:'palette';edit:PaletteEdit}|{kind:'slices';slices:SpriteSlice[]};
export interface AuthoredState {width:number;height:number;conversion:PixelDocument['conversion'];indexed:PixelDocument['indexed'];editingMode:PixelDocument['editingMode'];frames:Frame[];activeFrameId:string;tags:PixelDocument['tags'];outputMode:PixelDocument['outputMode'];layers:Layer[];groups:LayerGroup[];activeLayerId:string;references:ReferenceImage[];activeReferenceId:string|null;palette:string[];paletteOrganisation?:PaletteOrganisation;slices?:SpriteSlice[]}
export interface AuthoredPlan {readonly baseline:string;readonly changed:boolean;readonly historyBytes:number;readonly preview:Uint8ClampedArray;readonly displayPreview:Uint8ClampedArray}
const plans=new WeakMap<AuthoredPlan,{options:AuthoredOperation;state:AuthoredState}>();
export function authoredState(doc:PixelDocument):AuthoredState{return {width:doc.width,height:doc.height,conversion:doc.conversion?{...doc.conversion,recipe:structuredClone(doc.conversion.recipe)}:undefined,indexed:copyIndexedDocument(doc.indexed),editingMode:doc.editingMode,frames:doc.frames.map(f=>({...f})),activeFrameId:doc.activeFrameId,tags:doc.tags.map(t=>({...t})),outputMode:doc.outputMode,layers:doc.layers.map(l=>copyLayer(doc,l)),groups:doc.groups.map(g=>({...g,...(g.effects?{effects:g.effects.map(e=>({...e}))}:{})})),activeLayerId:doc.activeLayerId,references:doc.references.map(r=>({...r,...(r.placement?{placement:{...r.placement}}:{})})),activeReferenceId:doc.activeReferenceId,palette:doc.palette.slice(),...(doc.paletteOrganisation?{paletteOrganisation:structuredClone(doc.paletteOrganisation)}:{}),...(doc.slices?{slices:doc.slices.map(s=>({...s}))}:{})};}
export function restoreAuthored(doc:PixelDocument,state:AuthoredState){const copy=authoredState({...doc,...state,paletteOrganisation:state.paletteOrganisation,slices:state.slices});doc.width=copy.width;doc.height=copy.height;if(copy.conversion)doc.conversion=copy.conversion;else delete doc.conversion;if(copy.indexed)doc.indexed=copy.indexed;else delete doc.indexed;if(copy.editingMode)doc.editingMode=copy.editingMode;else delete doc.editingMode;doc.frames=copy.frames;doc.activeFrameId=copy.activeFrameId;doc.tags=copy.tags;if(copy.outputMode)doc.outputMode=copy.outputMode;else delete doc.outputMode;doc.layers=copy.layers.map(l=>copyLayer(doc,l));doc.groups=copy.groups;doc.activeLayerId=copy.activeLayerId;doc.references=copy.references;doc.activeReferenceId=copy.activeReferenceId;doc.palette=copy.palette;if(copy.paletteOrganisation)doc.paletteOrganisation=copy.paletteOrganisation;else delete doc.paletteOrganisation;if(copy.slices)doc.slices=copy.slices;else delete doc.slices;}
function editable(doc:PixelDocument,id:string){const l=doc.layers.find(l=>l.id===id);if(!l||!l.visible||l.locked||groupAncestors(doc,l.groupId).some(g=>!g.visible||g.locked))throw new Error('Show and unlock the target layer and groups.');return l;}
function paletteEdit(doc:PixelDocument,e:PaletteEdit){
 const p=doc.palette,o=doc.paletteOrganisation??{groups:[],locked:[]};doc.paletteOrganisation=o;
 const index=(n:number)=>{if(!Number.isInteger(n)||n<0||n>=p.length)throw new Error('Choose an existing palette index.');};
 const group=(id:string)=>{const g=o.groups.find(g=>g.id===id);if(!g)throw new Error('Palette group is missing.');return g;};
 if(e.action==='clear-organisation'){delete doc.paletteOrganisation;return;}
 if(e.action==='add-group'){let n=1;while(o.groups.some(g=>g.id===`palette-group-${n}`))n++;o.groups.push({id:`palette-group-${n}`,name:e.name.trim(),indices:[]});}
 else if(e.action==='rename-group')group(e.id).name=e.name.trim();
 else if(e.action==='remove-group'){group(e.id);o.groups=o.groups.filter(g=>g.id!==e.id);}
 else if(e.action==='add'){p.push(validatePalette([e.color])[0]);}
 else{index(e.index);
  if(e.action==='assign'){if(e.id!==null)group(e.id);for(const g of o.groups)g.indices=g.indices.filter(i=>i!==e.index);if(e.id!==null)group(e.id).indices.push(e.index);}
  else if(e.action==='lock'){if(typeof e.locked!=='boolean')throw new Error('Lock must be Boolean.');o.locked=o.locked.filter(i=>i!==e.index);if(e.locked)o.locked.push(e.index);}
  else if(e.action==='replace'){if(o.locked.includes(e.index))throw new Error('Unlock this swatch before replacing it.');p[e.index]=validatePalette([e.color])[0];}
  else if(e.action==='remove'){if(p.length===1)throw new Error('Keep at least one palette swatch.');if(o.locked.includes(e.index))throw new Error('Unlock this swatch before removing it.');p.splice(e.index,1);const remap=(indices:number[])=>indices.filter(i=>i!==e.index).map(i=>i>e.index?i-1:i);o.locked=remap(o.locked);for(const g of o.groups)g.indices=remap(g.indices);}
  else if(e.action==='move'){index(e.to);const order=p.map((_,i)=>i),[id]=order.splice(e.index,1);order.splice(e.to,0,id);doc.palette=order.map(i=>p[i]);o.locked=o.locked.map(i=>order.indexOf(i));for(const g of o.groups)g.indices=g.indices.map(i=>order.indexOf(i));}
  else throw new Error('Unknown palette operation.');
 }doc.palette=validatePaletteSlots(doc.palette);o.locked.sort((a,b)=>a-b);for(const g of o.groups)g.indices.sort((a,b)=>a-b);
}
export function prepareAuthored(doc:PixelDocument,input:AuthoredOperation,budget=8*1024*1024):AuthoredPlan {
 const o=structuredClone(input),state=authoredState(doc),draft={...doc,...state};
 if(!o)throw new Error('Choose an authored operation.');
 if(o.kind==='indexed-geometry')indexedGeometryOperation(draft,o);
 else if(o.kind==='indexed-selection'||o.kind==='indexed-selection-clear'||o.kind==='indexed-selection-paint')indexedSelectionOperation(draft,o);
 else if(o.kind==='indexed-tool')indexedToolOperation(draft,o);
 else if(o.kind==='indexed-document')indexedOperation(draft,o);
 else if(o.kind==='indexed-cel'&&draft.indexed)importIndexedCel(draft,o.text,o.destination);
 else if(o.kind==='indexed-cel'){const image=expandIndexedCel(decodeIndexedCel(o.text));if(image.width!==doc.width||image.height!==doc.height)throw new Error('Indexed cel must match the canvas dimensions.');if(!['layer','cel'].includes(o.destination))throw new Error('Choose indexed cel destination.');const current=editable(draft,doc.activeLayerId),mapped=editingPixels(draft,image.pixels),pixels=mapped.some(v=>v!==0)?mapped:new Uint8ClampedArray(0);if(current.text||current.adjustment)throw new Error('Select a raster artwork layer for indexed import.');if(o.destination==='cel'){const previous=current.cels[doc.activeFrameId];for(const id of Object.keys(current.cels))if(current.cels[id]===previous)current.cels[id]=pixels;}else{checkCelBudget(doc.width,doc.height,doc.layers.length+1,doc.frames.length);let n=1;while(draft.layers.some(l=>l.id===`layer-${n}`))n++;const layer=makeLayer(doc,`layer-${n}`,'Indexed cel',true,Object.fromEntries(doc.frames.map(f=>[f.id,f.id===doc.activeFrameId?pixels:new Uint8ClampedArray(0)])),{groupId:current.groupId});draft.layers.splice(draft.layers.indexOf(current)+1,0,layer);draft.activeLayerId=layer.id;}}
 else if(o.kind==='editing-policy'){if(!['rgba','grayscale'].includes(o.mode))throw new Error('Choose RGBA or grayscale editing.');if(o.mode==='grayscale'){sourceGrayscale(draft);draft.editingMode='grayscale';}else delete draft.editingMode;}
 else if(o.kind==='source-grayscale')sourceGrayscale(draft);
 else if(o.kind==='document-transfer')transferDocument(draft,decodeProject(o.project),o.destination);
 else if(o.kind==='reference-placement'){validatePlacement(o.placement);const r=draft.references.find(r=>r.id===o.id);if(!r)throw new Error('Reference is missing.');r.placement={...o.placement};}
 else if(o.kind==='text'||o.kind==='adjustment'){
  if(typeof o.name!=='string'||!o.name.trim()||o.name.trim().length>80)throw new Error('Layer name must be 1-80 characters.');
  let l:Layer;if(o.kind==='text'&&o.id){l=editable(draft,o.id);if(!l.text)throw new Error('Select an editable text layer.');}
  else{if(groupAncestors(doc,doc.layers.find(l=>l.id===doc.activeLayerId)!.groupId).some(g=>g.locked||!g.visible))throw new Error('Show and unlock the parent group before creating a live layer.');checkCelBudget(doc.width,doc.height,doc.layers.length+1,doc.frames.length);let n=1;while(draft.layers.some(l=>l.id===`layer-${n}`))n++;l=makeLayer(doc,`layer-${n}`,o.name.trim(),true,Object.fromEntries(doc.frames.map(f=>[f.id,new Uint8ClampedArray(0)])),{groupId:doc.layers.find(l=>l.id===doc.activeLayerId)!.groupId});draft.layers.splice(draft.layers.findIndex(l=>l.id===doc.activeLayerId)+1,0,l);draft.activeLayerId=l.id;}
  l.name=o.name.trim();if(o.kind==='text'){validateBitmapText(o.text);l.text={...o.text,color:editingInk(draft,[...o.text.color])};}else{validateLiveEffects(o.effects);l.adjustment=true;l.effects=o.effects.map(e=>({...e}));}
 }else if(o.kind==='rasterize-text'){const l=editable(draft,o.id);if(!l.text)throw new Error('Select a text layer.');const p=renderBitmapText(doc.width,doc.height,l.text);l.cels=Object.fromEntries(doc.frames.map(f=>[f.id,p.slice()]));delete l.text;}
 else if(o.kind==='layer-effects'){const l=editable(draft,o.id);validateLiveEffects(o.effects);if(o.effects.length)l.effects=o.effects.map(e=>({...e}));else delete l.effects;}
 else if(o.kind==='group-effects'){const g=draft.groups.find(g=>g.id===o.id);if(!g||groupAncestors(draft,g.id).some(g=>g.locked||!g.visible))throw new Error('Show and unlock the group and its parents.');validateLiveEffects(o.effects);if(o.effects.length)g.effects=o.effects.map(e=>({...e}));else delete g.effects;}
 else if(o.kind==='flatten'){const cels=Object.fromEntries(doc.frames.map(f=>[f.id,composite(doc,f.id)]));draft.layers=[makeLayer(doc,'layer-1','Flattened artwork',true,cels)];draft.groups=[];draft.activeLayerId='layer-1';}
 else if(o.kind==='palette')paletteEdit(draft,o.edit);
 else if(o.kind==='slices')draft.slices=o.slices.map(s=>({...s}));
 else throw new Error('Unknown authored operation.');
 if(o.kind==='palette')draft.palette=editingPalette(draft,draft.palette);
 validateIndexedDocument(draft);validateGroups(draft);validateReferences(draft);validateAuthoredMetadata(draft);
 const baseline=encodeProject(doc,false),changed=encodeProject(draft,false)!==baseline;
 const buffers=new Set<Uint8Array|Uint8ClampedArray>([...Object.values(doc.indexed?.cels??{}),...Object.values(draft.indexed?.cels??{})].flatMap(c=>Object.values(c)));for(const b of new Set([...doc.layers,...draft.layers].flatMap(l=>[...Object.values(l.cels),...(l.mask?[l.mask.values]:[])]).concat([...doc.references,...draft.references].map(r=>r.pixels))))buffers.add(b);
 const historyBytes=[...buffers].reduce((n,p)=>n+p.byteLength,0)+(doc.layers.length+draft.layers.length+doc.groups.length+draft.groups.length)*4096+32768;
 if(changed&&(!Number.isFinite(budget)||historyBytes>budget))throw new Error('Authored operation exceeds the undo memory budget.');
 const after=authoredState(draft),plan=Object.freeze({baseline,changed,historyBytes,get preview(){return composite(draft);},get displayPreview(){return referenceDisplay(draft);}});plans.set(plan,{options:o,state:after});return plan;
}
export function regenerateAuthored(doc:PixelDocument,plan:AuthoredPlan,budget:number){const stored=plans.get(plan);if(!stored||plan.baseline!==encodeProject(doc,false))throw new Error('Authored source changed. Prepare again.');const fresh=prepareAuthored(doc,stored.options,budget);return {plan:fresh,state:plans.get(fresh)!.state};}
