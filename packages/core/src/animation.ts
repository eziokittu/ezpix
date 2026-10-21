import type {PixelDocument} from './document.js';
export const MAX_TAGS=16;
export const PLAYBACK_MODES=['loop','once','reverse','ping-pong'] as const;
export type PlaybackMode=typeof PLAYBACK_MODES[number];
/** Inclusive zero-based frame slots. Reordering changes contents, not boundaries. */
export interface AnimationTag {id:string;name:string;from:number;to:number;mode:PlaybackMode}
export function validateTags(doc:Pick<PixelDocument,'frames'|'tags'>) {
  if(!Array.isArray(doc.tags)||doc.tags.length>MAX_TAGS)throw new Error('Projects support at most 16 animation tags.');
  const ids=new Set<string>(),names=new Set<string>();
  for(const t of doc.tags){
    if(!t||typeof t.id!=='string'||!/^tag-[1-9][0-9]{0,8}$/.test(t.id)||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name!==t.name.trim()||t.name.length>80||names.has(t.name.toLowerCase())||!Number.isInteger(t.from)||!Number.isInteger(t.to)||t.from<0||t.to<t.from||t.to>=doc.frames.length||!PLAYBACK_MODES.includes(t.mode))throw new Error('Invalid animation tag: use a unique name, valid frame range and playback mode.');
    ids.add(t.id);names.add(t.name.toLowerCase());
  }
}
/** Pure duration-based range playback. Endpoints are not repeated in ping-pong. */
export function animationAtTime(doc:PixelDocument,elapsed:number,options:{tagId?:string;mode?:PlaybackMode}={}) {
  if(!Number.isFinite(elapsed)||elapsed<0)throw new Error('Invalid playback time.');
  const tag=options.tagId?doc.tags.find(t=>t.id===options.tagId):undefined;
  if(options.tagId&&!tag)throw new Error('Tag is missing.');
  const mode=options.mode??tag?.mode??'loop';if(!PLAYBACK_MODES.includes(mode))throw new Error('Invalid playback mode.');
  let frames=doc.frames.slice(tag?.from??0,(tag?.to??doc.frames.length-1)+1);
  if(mode==='reverse')frames.reverse();
  // Preserve the original all-frame forward loop starting at the editing frame.
  if(!tag&&mode==='loop'){const start=frames.findIndex(f=>f.id===doc.activeFrameId);frames=[...frames.slice(start),...frames.slice(0,start)];}
  if(mode==='ping-pong'&&frames.length>2)frames=[...frames,...frames.slice(1,-1).reverse()];
  const duration=frames.reduce((sum,f)=>sum+f.duration,0),done=mode==='once'&&elapsed>=duration;
  let time=mode==='once'?Math.min(elapsed,duration-1):elapsed%duration;
  for(const frame of frames){if(time<frame.duration)return {frameId:frame.id,done};time-=frame.duration;}
  return {frameId:frames.at(-1)!.id,done};
}
