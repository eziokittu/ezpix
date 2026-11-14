import {stampVisible} from './design-tools.js';
import {validateRaster,convert,defaultRecipe,type Raster,type Recipe} from './conversion.js';
import {editPhoto,type PhotoEdit} from './photo-edit.js';
import {focusRaster,type FocusOptions} from './focus.js';

export type WorkspaceEdit = PhotoEdit | {kind:'tone';options:FocusOptions;recipe?:Recipe} | {kind:'empty'};
export interface PhotoOperation {createdAt?:number;id:string;name:string;edit:WorkspaceEdit;mask:Uint8Array|null;}
export interface PhotoLayer {id:string;name:string;visible:boolean;locked:boolean;opacity:number;edit:WorkspaceEdit;mask:Uint8Array|null;operations?:PhotoOperation[];}
export interface PhotoSnapshot {format:'ezpix-photo';version:1|2;original:Raster[];layers:PhotoLayer[];active:string;selection?:Uint8Array|null;fps?:number;}
const clone=<T>(value:T):T=>structuredClone(value);
const budget=64*1024*1024;

/** Full-canvas, local photo layers. Geometry changes affect the canvas; other edits respect membership. */
export function renderWorkspaceEdit(source:Raster,edit:WorkspaceEdit,mask:Uint8Array|null):Raster {
 if(edit.kind==='empty')return source;
 let next:Raster;
 if(edit.kind==='tone'){
  next=focusRaster(source,{...edit.options,rect:{x:0,y:0,width:source.width,height:source.height},mask:undefined});
  if(edit.recipe){const recipe={...edit.recipe,crop:{x:0,y:0,width:next.width,height:next.height}};const doc=convert(next,recipe);const small={width:doc.width,height:doc.height,pixels:doc.cel.pixels};next=editPhoto(small,{kind:'resize',width:source.width,height:source.height,sampling:'nearest'});}
 }else next=editPhoto(source,edit);
 if(mask){
  if(mask.length!==source.width*source.height)throw Error('This selection belongs to a different canvas size.');
  if(next.width!==source.width||next.height!==source.height)throw Error('Clear the selection before changing canvas dimensions.');
  const pixels=next.pixels.slice();for(let i=0;i<mask.length;i++)if(!mask[i])pixels.set(source.pixels.subarray(i*4,i*4+4),i*4);
  next={...next,pixels};
 }
 return next;
}
export class PhotoWorkspace {
 private value:PhotoSnapshot;
 private revisionValue=0;
 get revision(){return this.revisionValue;}
 layerInfo(){return this.value.layers.map(({id,name,visible,locked,opacity})=>({id,name,visible,locked,opacity}));}
 private undo:PhotoSnapshot[]=[];private redo:PhotoSnapshot[]=[];private historyGroup:string|undefined;
 // Raster inputs and committed operations are immutable internally. History shares them;
 // public snapshots remain defensive copies. Cache only a bounded set of first-frame stages.
 private stages=new Map<PhotoOperation,{source:Raster;result:Raster}>();
 private stageBytes=0;
 private cachedBytes(operation:PhotoOperation,entry:{source:Raster;result:Raster}){return entry.source.pixels.byteLength+entry.result.pixels.byteLength+(['stamp','patch'].includes(operation.edit.kind)?(operation.edit as Extract<WorkspaceEdit,{kind:'stamp'|'patch'}>).image.pixels.byteLength:0);}
 private fork(){return {...this.value,layers:this.value.layers.map(l=>({...l,...(l.operations?{operations:l.operations.slice()}:{})}))};}
 constructor(original:Raster[],grouped=false){original.forEach(validateRaster);if(!original.length||original.length>32||original.reduce((n,f)=>n+f.pixels.byteLength,0)>32*1024*1024)throw Error('Photo project exceeds its media budget.');this.value={format:'ezpix-photo',version:grouped?2:1,original:clone(original),layers:[],active:''};if(grouped){const id=crypto.randomUUID();this.value.layers=[{id,name:'Layer 1',visible:true,locked:false,opacity:1,edit:{kind:'empty'},mask:null,operations:[]}];this.value.active=id;}}
 snapshot(){return clone(this.value);}
 original(){return this.value.original[0];}
 layers(){return clone(this.value.layers);}
 get active(){return this.value.active;}
 select(id:string){if(id&&!this.value.layers.some(l=>l.id===id))throw Error('Layer unavailable.');if(this.value.active!==id){this.value={...this.value,active:id};this.revisionValue++;}}
 history(){return {undo:!!this.undo.length,redo:!!this.redo.length,steps:this.undo.length};}
 private change(update:(value:PhotoSnapshot)=>void,render=true,group?:string){const next=this.fork();update(next);this.validate(next);if(render)this.render(next);if(!group||group!==this.historyGroup)this.undo.push(this.value);this.historyGroup=group;this.redo=[];this.value=next;this.revisionValue++;}
 rememberSelection(mask:Uint8Array|null,replace=false){if(mask===null&&this.value.selection==null)return;if(mask&&this.value.selection&&mask.length===this.value.selection.length&&mask.every((v,i)=>v===this.value.selection![i]))return;if(replace){this.value={...this.value,selection:mask?.slice()??null};this.revisionValue++;this.redo=[];}else this.change(s=>{s.selection=mask?.slice()??null;},false);}
 savedSelection(){return this.value.selection?.slice()??null;}
 private bytes(s:PhotoSnapshot){return s.original.reduce((n,f)=>n+f.pixels.byteLength,0)+s.layers.reduce((n,l)=>n+this.operations(l).reduce((n,o)=>n+(o.mask?.byteLength??0)+(o.edit.kind==='patch'?o.edit.image.pixels.byteLength+o.edit.mask.byteLength:o.edit.kind==='stamp'?o.edit.image.pixels.byteLength:o.edit.kind==='collage'?o.edit.images.reduce((n,f)=>n+f.pixels.byteLength,0):o.edit.kind==='clone'?(o.edit.sourceMask?.byteLength??0)+(o.edit.targetMask?.byteLength??0):0),0),0);}
 private operations(layer:PhotoLayer):PhotoOperation[]{return layer.operations??[{id:layer.id,name:layer.name,edit:layer.edit,mask:layer.mask}];}
 objects(tools?:readonly string[]){return this.value.layers.flatMap(layer=>this.operations(layer).filter(o=>!tools||tools.includes(o.edit.kind)||o.edit.kind==='stamp'&&tools.includes(o.edit.editor?.tool??'')).map(operation=>({...clone(operation),layerId:layer.id,visible:layer.visible,locked:layer.locked})));}
 hasObject(id:string){return this.value.layers.some(l=>this.operations(l).some(o=>o.id===id));}
 updateCollage(id:string,properties:Omit<Extract<WorkspaceEdit,{kind:'collage'}>,'images'>,group?:string){this.change(s=>{const object=s.layers.flatMap(l=>this.operations(l)).find(o=>o.id===id);if(object?.edit.kind!=='collage')throw Error('Choose a collage first.');const edit={...clone(properties),images:object.edit.images};this.write(s,edit,object.name,null,id,true);},true,group);}
 appendBatch(edits:{edit:WorkspaceEdit;name:string}[],group?:string){if(!edits.length||edits.length>4)throw Error('Invalid grouped edit.');const ids:string[]=[];this.change(s=>{for(const item of edits)ids.push(this.write(s,item.edit,item.name,null));},true,group);return ids;}
 private group(s:PhotoSnapshot){s.version=2;s.layers.forEach(l=>{l.operations??=this.operations(l);l.edit={kind:'empty'};l.mask=null;});}
 addLayer(name='New layer'){const id=crypto.randomUUID();this.change(s=>{this.group(s);s.layers.push({id,name:name.slice(0,80),visible:true,locked:false,opacity:1,edit:{kind:'empty'},mask:null,operations:[]});s.active=id;});return id;}
 private write(s:PhotoSnapshot,edit:WorkspaceEdit,name:string,mask:Uint8Array|null,id?:string,draft=false){const key=id??crypto.randomUUID();this.group(s);const layer=id?s.layers.find(l=>l.operations!.some(o=>o.id===id)):s.layers.find(l=>l.id===s.active);if(!layer)throw Error('Add or select a layer before editing.');if(layer.locked)throw Error('Unlock the layer before editing.');if(!layer.visible)throw Error('Show the layer before editing.');const value=draft?edit:clone(edit);if(id){const index=layer.operations!.findIndex(o=>o.id===id);layer.operations![index]={...layer.operations![index],edit:value,name:name.slice(0,80)};}else layer.operations!.push({createdAt:Math.max(Date.now(),...s.layers.flatMap(l=>l.operations??[]).map(o=>(o.createdAt??0)+1)),id:key,name:name.slice(0,80),edit:value,mask:mask?.slice()??null});s.active=layer.id;return key;}
 append(edit:WorkspaceEdit,name:string,mask:Uint8Array|null=null,id?:string,group?:string){let key='';const dimensions=edit.kind==='stamp'&&!id?this.renderFirst():undefined;this.change(s=>{if(dimensions)for(const layer of s.layers)if(layer.visible&&!layer.locked&&layer.operations)layer.operations=layer.operations.filter(o=>o.edit.kind!=='stamp'||stampVisible(o.edit,dimensions.width,dimensions.height));key=this.write(s,edit,name,mask,id);},true,group);return key;}
 removeObject(id:string){this.change(s=>{const layer=s.layers.find(l=>this.operations(l).some(o=>o.id===id));if(!layer||layer.locked)throw Error('Unlock the layer before editing.');if(layer.operations)layer.operations=layer.operations.filter(o=>o.id!==id);else{layer.edit={kind:'empty'};layer.mask=null;}});}
 private stageDraft(draft:{edit:WorkspaceEdit;id?:string;mask?:Uint8Array|null;name?:string}){const next=this.fork();this.write(next,draft.edit,draft.name??'Live edit',draft.mask??null,draft.id,true);this.validate(next);return next;}
 withDraft(draft:{edit:WorkspaceEdit;id?:string;mask?:Uint8Array|null;name?:string}){const next=this.stageDraft(draft);this.render(next);return clone(next);}
 renderFirst(draft?:{edit:WorkspaceEdit;id?:string;mask?:Uint8Array|null},layerId?:string){const state=draft?this.stageDraft(draft):this.value;return this.renderFrame(state.original[0],layerId?{...state,layers:state.layers.filter(l=>l.id===layerId).map(l=>({...l,visible:true}))}:state,true);}
 private renderFrame(frame:Raster,state:PhotoSnapshot,cache=false){let out=frame;for(const layer of state.layers){if(!layer.visible)continue;let next=out;for(const operation of this.operations(layer)){const saved=cache?this.stages.get(operation):undefined;if(saved?.source===next){next=saved.result;continue;}const input=next;next=renderWorkspaceEdit(next,operation.edit,operation.mask);if(cache&&next!==input&&next.pixels.byteLength<=24*1024*1024){const old=this.stages.get(operation);if(old)this.stageBytes-=this.cachedBytes(operation,old);this.stages.delete(operation);this.stages.set(operation,{source:input,result:next});this.stageBytes+=this.cachedBytes(operation,{source:input,result:next});while(this.stageBytes>48*1024*1024){const key=this.stages.keys().next().value!;this.stageBytes-=this.cachedBytes(key,this.stages.get(key)!);this.stages.delete(key);}}}if(layer.opacity===1)out=next;else{if(next.width!==out.width||next.height!==out.height)throw Error('Canvas geometry layers require full opacity.');const pixels=out.pixels.slice();for(let i=0;i<pixels.length;i++)pixels[i]=out.pixels[i]*(1-layer.opacity)+next.pixels[i]*layer.opacity;out={...next,pixels};}}return out;}
 private validate(s:PhotoSnapshot){if(s.format!=='ezpix-photo'||![1,2].includes(s.version)||!Array.isArray(s.original)||!s.original.length||s.original.length>32||!Array.isArray(s.layers)||s.layers.length>48)throw Error('Invalid photo project.');s.original.forEach(validateRaster);if(s.fps!==undefined&&(!Number.isInteger(s.fps)||s.fps<1||s.fps>4))throw Error('Invalid photo frame rate.');if(s.selection!==undefined&&s.selection!==null&&(!(s.selection instanceof Uint8Array)||s.selection.some(n=>n>1)))throw Error('Invalid saved selection.');if(this.bytes(s)>budget)throw Error('Photo layers exceed 64 MiB. Save a copy before adding more.');const objectIds=new Set<string>();for(const l of s.layers){if(s.version===1&&l.operations!==undefined||s.version===2&&!Array.isArray(l.operations))throw Error('Invalid photo project version.');const operations=this.operations(l);if(operations.length>256)throw Error('A layer supports at most 256 editable objects.');for(const o of operations){if(typeof o.id!=='string'||!o.id||objectIds.has(o.id)||typeof o.name!=='string'||o.name.length>80||!o.edit||typeof o.edit.kind!=='string'||o.mask!==null&&(!(o.mask instanceof Uint8Array)||o.mask.some(n=>n>1)))throw Error('Invalid editable object.');objectIds.add(o.id);}}const ids=new Set<string>();for(const l of s.layers){if(typeof l.id!=='string'||!l.id||ids.has(l.id)||typeof l.name!=='string'||l.name.length>80||typeof l.visible!=='boolean'||typeof l.locked!=='boolean'||!Number.isFinite(l.opacity)||l.opacity<0||l.opacity>1||l.mask!==null&&(!(l.mask instanceof Uint8Array)||l.mask.some(n=>n>1)))throw Error('Invalid photo layer.');ids.add(l.id);}if(s.active&&!ids.has(s.active))throw Error('Invalid active layer.');}
 render(state=this.value,draft?:{edit:WorkspaceEdit;id?:string;mask?:Uint8Array|null}):Raster[]{
  if(draft)return this.render(this.stageDraft(draft));
  return state.original.map((frame,index)=>this.renderFrame(frame,state,index===0));
 }
 put(edit:WorkspaceEdit,name:string,mask:Uint8Array|null=null,id?:string){let result=id??crypto.randomUUID();this.change(s=>{if(id){const layer=s.layers.find(l=>l.id===id);if(!layer||layer.locked)throw Error('Unlock the layer before editing.');layer.edit=clone(edit);}else{s.layers.push({id:result,name:name.slice(0,80),visible:true,locked:false,opacity:1,edit:clone(edit),mask:mask?.slice()??null});}s.active=result;});return result;}
 mutate(id:string,action:'delete'|'duplicate'|'up'|'down'|'visible'|'lock'|'rename'|'opacity',value?:string|number){this.change(s=>{const i=s.layers.findIndex(l=>l.id===id);if(i<0)throw Error('Choose a layer first.');const l=s.layers[i];if(l.locked&&!['lock','visible'].includes(action))throw Error('Unlock this layer first.');if(action==='delete'){s.layers.splice(i,1);s.active=s.layers.at(-1)?.id??'';}if(action==='duplicate'){const copy=clone(l);copy.id=crypto.randomUUID();if(copy.operations)copy.operations.forEach(o=>o.id=crypto.randomUUID());copy.name=(copy.name+' copy').slice(0,80);s.layers.splice(i+1,0,copy);s.active=copy.id;}if(action==='up'&&i<s.layers.length-1)[s.layers[i],s.layers[i+1]]=[s.layers[i+1],s.layers[i]];if(action==='down'&&i>0)[s.layers[i],s.layers[i-1]]=[s.layers[i-1],s.layers[i]];if(action==='visible')l.visible=!l.visible;if(action==='lock')l.locked=!l.locked;if(action==='rename')l.name=String(value).slice(0,80);if(action==='opacity')l.opacity=Number(value);});}
 undoEdit(){this.historyGroup=undefined;const previous=this.undo.pop();if(!previous)return false;this.redo.push(this.value);this.value=previous;this.revisionValue++;return true;}
 redoEdit(){this.historyGroup=undefined;const next=this.redo.pop();if(!next)return false;this.undo.push(this.value);this.value=next;this.revisionValue++;return true;}
 restore(value:PhotoSnapshot){const next=clone(value);this.validate(next);this.render(next);this.value=next;this.revisionValue++;this.undo=[];this.redo=[];this.stages.clear();this.stageBytes=0;}
}
