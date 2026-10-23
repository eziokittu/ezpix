import {advancedComposite} from './advanced-composite.js';
import {validateLiveEffects,type LiveEffect} from './layer-render.js';
import {renderLayerPixels} from './layer-render.js';
import {blendChannel} from './blend.js';
import type {PixelDocument,Layer} from './document.js';
export interface LayerGroup {id:string;name:string;parentId:string|null;visible:boolean;locked:boolean;opacity:number;effects?:LiveEffect[]}
export interface LayerNode {id:string;group:boolean;children:LayerNode[]}
export const MAX_GROUPS=16,MAX_GROUP_DEPTH=4;
export function groupAncestors(doc:PixelDocument,parentId:string|null):LayerGroup[]{
 const out:LayerGroup[]=[];while(parentId!==null){if(out.length>=MAX_GROUP_DEPTH)throw new Error('Groups support at most four nesting levels.');const g=doc.groups.find(g=>g.id===parentId);if(!g||out.some(a=>a.id===g.id))throw new Error('Missing or cyclic layer group.');out.push(g);parentId=g.parentId;}return out;
}
export function layerVisible(doc:PixelDocument,layer:Layer){return layer.visible&&groupAncestors(doc,layer.groupId).every(g=>g.visible);}
export function layerEditable(doc:PixelDocument,layer:Layer){return !layer.text&&!layer.adjustment&&layer.visible&&!layer.locked&&groupAncestors(doc,layer.groupId).every(g=>g.visible&&!g.locked);}
export function descendantLayers(doc:PixelDocument,id:string){return doc.layers.filter(l=>groupAncestors(doc,l.groupId).some(g=>g.id===id));}
/** Groups have at least one leaf; leaves of each subtree occupy one contiguous span. */
export function validateGroups(doc:PixelDocument){
 if(!Array.isArray(doc.groups)||doc.groups.length>MAX_GROUPS)throw new Error('Projects support at most 16 groups.');const ids=new Set<string>();
 for(const g of doc.groups){if(!g||typeof g.id!=='string'||!/^group-[1-9][0-9]{0,8}$/.test(g.id)||ids.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>80||typeof g.visible!=='boolean'||typeof g.locked!=='boolean'||!Number.isInteger(g.opacity)||g.opacity<0||g.opacity>255||g.parentId!==null&&typeof g.parentId!=='string')throw new Error('Invalid layer group metadata.');validateLiveEffects(g.effects);ids.add(g.id);}
 for(const g of doc.groups)groupAncestors(doc,g.id);
 for(const l of doc.layers){if(l.groupId!==null&&typeof l.groupId!=='string')throw new Error('Invalid layer group membership.');groupAncestors(doc,l.groupId);}
 for(const g of doc.groups){const at=descendantLayers(doc,g.id).map(l=>doc.layers.indexOf(l));if(!at.length)throw new Error('Groups need at least one layer. Ungroup before moving or deleting their last child.');if(at.at(-1)!-at[0]+1!==at.length)throw new Error('Group layers must occupy one contiguous subtree.');}
}
export function layerForest(doc:PixelDocument,parentId:string|null=null):LayerNode[]{
 const items:LayerNode[]=[...doc.layers.filter(l=>l.groupId===parentId).map(l=>({id:l.id,group:false,children:[]})),...doc.groups.filter(g=>g.parentId===parentId).map(g=>({id:g.id,group:true,children:layerForest(doc,g.id)}))];
 const first=(n:LayerNode):number=>n.group?first(n.children[0]):doc.layers.findIndex(l=>l.id===n.id);return items.sort((a,b)=>first(a)-first(b));
}
export function layerRows(doc:PixelDocument){const rows:{id:string;group:boolean;depth:number}[]=[];const visit=(nodes:LayerNode[],depth:number)=>{for(const n of nodes.slice().reverse()){rows.push({id:n.id,group:n.group,depth});if(n.group)visit(n.children,depth+1);}};visit(layerForest(doc),0);return rows;}
/** Premultiplied floats inside isolated groups; round only the final document pixel. */
export function groupedComposite(doc:PixelDocument,frameId:string){
 if(doc.layers.some(l=>l.text||l.adjustment)||doc.groups.some(g=>g.effects?.some(e=>e.enabled)))return advancedComposite(doc,frameId);
 const forest=layerForest(doc),layers=new Map(doc.layers.map(l=>[l.id,l])),groups=new Map(doc.groups.map(g=>[g.id,g])),rasters=new Map(doc.layers.map(l=>[l.id,renderLayerPixels(l,doc.width,doc.height,frameId)]));
 function render(nodes:LayerNode[],p:number):number[]{let r=0,g=0,b=0,a=0;for(const n of nodes){const item=n.group?groups.get(n.id)!:layers.get(n.id)!;if(!item.visible||!item.opacity)continue;let sr:number,sg:number,sb:number,sa:number;const opacity=item.opacity/255;
  if(n.group){[sr,sg,sb,sa]=render(n.children,p);sr*=opacity;sg*=opacity;sb*=opacity;sa*=opacity;}else{const q=rasters.get(n.id)!;if(!q.length)continue;sa=q[p+3]/255*opacity;sr=q[p]*sa;sg=q[p+1]*sa;sb=q[p+2]*sa;}
  if(!n.group){const mode=layers.get(n.id)!.blendMode;if(mode!=='normal'&&a&&sa){sr=(1-a)*sr+sa*a*blendChannel(r/a,sr/sa,mode);sg=(1-a)*sg+sa*a*blendChannel(g/a,sg/sa,mode);sb=(1-a)*sb+sa*a*blendChannel(b/a,sb/sa,mode);}}
  const remain=1-sa;r=sr+r*remain;g=sg+g*remain;b=sb+b*remain;a=sa+a*remain;
 }return [r,g,b,a];}
 const out=new Uint8ClampedArray(doc.width*doc.height*4);for(let p=0;p<out.length;p+=4){const [r,g,b,a]=render(forest,p);if(a){out[p]=Math.round(r/a);out[p+1]=Math.round(g/a);out[p+2]=Math.round(b/a);out[p+3]=Math.round(a*255);}}return out;
}
