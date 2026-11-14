export interface LivePreviewState {ready:boolean;pending:boolean;error?:string;}

/** Coalesced UI previews. Apply commits the exact last successfully displayed edit. */
export function createLivePreview<T>(options:{automatic?:boolean|(()=>boolean);read():T;copy?:(value:T)=>T;preview(value:T):void;apply(value:T):void;cancel():void;state(value:LivePreviewState):void;schedule?:(callback:()=>void)=>number;unschedule?:(id:number)=>void}){
 let queued:number|undefined,value:T|undefined,ready=false,disposed=false,generation=0;
 const schedule=options.schedule??(callback=>requestAnimationFrame(callback)),unschedule=options.unschedule??(id=>cancelAnimationFrame(id));
 const copy=options.copy??(<V>(value:V):V=>structuredClone(value));
 const clear=()=>{generation++;if(queued!==undefined)unschedule(queued);queued=undefined;};
 const render=(ticket=generation)=>{if(disposed||ticket!==generation)return;queued=undefined;try{const next=copy(options.read());options.preview(next);value=next;ready=true;options.state({ready:true,pending:false});if(typeof options.automatic==='function'?options.automatic():options.automatic){options.apply(copy(next));value=undefined;ready=false;options.state({ready:false,pending:false});}}catch(error){ready=false;options.state({ready:false,pending:false,error:(error as Error).message});}};
 return {
  request(immediate=false){if(disposed)return;clear();ready=false;options.state({ready:false,pending:true});const ticket=generation;if(immediate)render(ticket);else queued=schedule(()=>render(ticket));},
  apply(){if(disposed||!ready||queued!==undefined||value===undefined)return false;try{options.apply(copy(value));clear();value=undefined;ready=false;options.state({ready:false,pending:false});return true;}catch(error){ready=false;options.state({ready:false,pending:false,error:(error as Error).message});return false;}},
  flush(){if(queued!==undefined){clear();render();}return this.apply();},
  cancel(){clear();value=undefined;ready=false;options.cancel();options.state({ready:false,pending:false});},
  dispose(){clear();disposed=true;value=undefined;ready=false;},
 };
}
