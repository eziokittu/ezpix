export type BrushShape = 'square' | 'circle';
export interface Brush { size: number; shape: BrushShape }
export const MAX_BRUSH_SIZE = 32;
/** Even brushes put the extra pixel to the right/bottom of the anchor. */
export function brushOffsets(brush: Brush): readonly {x:number;y:number}[] {
  if(!brush || !Number.isInteger(brush.size)||brush.size<1||brush.size>MAX_BRUSH_SIZE||!['square','circle'].includes(brush.shape))throw new Error('Brush size must be 1–32 whole pixels with a square or circle tip.');
  const key=brush.shape+brush.size,existing=cache.get(key);if(existing)return existing;
  const points:{x:number;y:number}[]=[],start=0-Math.floor((brush.size-1)/2),center=start+(brush.size-1)/2,radius=Math.max(.5,(brush.size-.5)/2);
  for(let y=start;y<start+brush.size;y++)for(let x=start;x<start+brush.size;x++)if(brush.shape==='square'||(x-center)**2+(y-center)**2<=radius**2)points.push(Object.freeze({x,y}));
  const result=Object.freeze(points);cache.set(key,result);return result;
}
const cache=new Map<string,readonly {x:number;y:number}[]>();
