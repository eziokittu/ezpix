/** 4x4 ordered threshold, anchored at canvas origin. Offsets use /50 units. */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
export function orderedPaletteOffset(x:number,y:number,strength:number):number{return (2*BAYER[(y%4)*4+x%4]-15)*strength;}
/** Integer scaled RGB distance, earliest palette member wins exact ties. */
export function nearestPalettePixel(rgb:readonly number[],palette:readonly number[][],offset=0,preserveExact=false):number[]{
 let best=palette[0],distance=Infinity;
 for(const candidate of palette){
  if(preserveExact&&candidate.every((v,k)=>v===rgb[k]))return candidate;
  const d=candidate.reduce((sum,v,k)=>sum+(50*(rgb[k]-v)+offset)**2,0);
  if(d<distance){distance=d;best=candidate;}
 }
 return best;
}
