import type {PhotoEdit} from './photo-edit.js';
import type {mountFocusStudio} from './focus-ui.js';
/** One replaceable operation per tool interaction. A new gesture is one Undo step. */
export function automaticEdit(api:ReturnType<typeof mountFocusStudio>,name:string){
 let images:unknown[]|undefined;let id:string|undefined,group=crypto.randomUUID();
 return {get id(){return id;},select(value?:string){id=value;group=crypto.randomUUID();},boundary(){group=crypto.randomUUID();},reset(){id=undefined;group=crypto.randomUUID();},write(edit:PhotoEdit){if(id&&!api.hasLayerObject(id))id=undefined;if(edit.kind==='collage'&&id&&images?.length===edit.images.length&&images.every((image,i)=>image===edit.images[i])){const {images:unused,...properties}=edit;void unused;api.updateCollageProperties(id,properties,group);}else id=api.applyAutomaticEdit(edit,name,id,group);images=edit.kind==='collage'?edit.images.slice():undefined;return id;}};
}
