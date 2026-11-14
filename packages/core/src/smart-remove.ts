import {validateRaster,type Raster} from './conversion.js';

/** Deterministic exemplar fill: match known boundary pixels to unselected image patches.
 * A bounded context image controls cost; source coordinates retain full-resolution texture.
 * No model, request, object recognition, or generated prompt content is involved.
 */
export function smartRemove(source:Raster,mask:Uint8Array):Raster{
 validateRaster(source);const {width,height}=source;
 if(!(mask instanceof Uint8Array)||mask.length!==width*height||mask.some(n=>n>1))throw Error('Select an area of this image first.');
 const count=mask.reduce((sum,n)=>sum+n,0);if(!count)throw Error('Select the object to remove first.');if(count>mask.length*.45)throw Error('Select a smaller area (under 45% of the image), leaving surrounding texture to sample.');
 const scale=Math.min(1,256/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),size=w*h;
 const original=new Uint8ClampedArray(size*4),work=new Uint8ClampedArray(size*4),hole=new Uint8Array(size),mapping=new Int32Array(size);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,sx=Math.min(width-1,Math.floor((x+.5)*width/w)),sy=Math.min(height-1,Math.floor((y+.5)*height/h));original.set(source.pixels.subarray((sy*width+sx)*4,(sy*width+sx)*4+4),i*4);mapping[i]=i;}
 // Max-pool membership so even a one-pixel selection survives downsampling.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x])hole[Math.min(h-1,Math.floor(y*h/height))*w+Math.min(w-1,Math.floor(x*w/width))]=1;
 work.set(original);const initial=hole.slice(),radius=2,donors:number[]=[];
 for(let y=radius;y<h-radius;y++)for(let x=radius;x<w-radius;x++){let clean=true;for(let dy=-radius;dy<=radius&&clean;dy++)for(let dx=-radius;dx<=radius;dx++)if(initial[(y+dy)*w+x+dx]){clean=false;break;}if(clean)donors.push(y*w+x);}
 if(!donors.length)throw Error('Leave a larger clean area around the selection to sample.');
 let remaining=hole.reduce((s,n)=>s+n,0),iterations=0;
 while(remaining){
  // Fill the boundary with the most known context first; never use the removed area as a donor.
  let target=-1,bestKnown=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!hole[i]||!((x&& !hole[i-1])||(x<w-1&&!hole[i+1])||(y&&!hole[i-w])||(y<h-1&&!hole[i+w])))continue;let known=0;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&!hole[(y+dy)*w+x+dx])known++;if(known>bestKnown){target=i;bestKnown=known;}}
  if(target<0||++iterations>size)throw Error('This selection could not be filled. Try a smaller region.');
  const tx=target%w,ty=Math.floor(target/w),context:{dx:number;dy:number;at:number}[]=[];
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(tx+dx>=0&&tx+dx<w&&ty+dy>=0&&ty+dy<h&&!hole[(ty+dy)*w+tx+dx])context.push({dx,dy,at:((ty+dy)*w+tx+dx)*4});
  let best=donors[0],score=Infinity;
  const compare=(candidate:number)=>{let error=0;for(const {dx,dy,at}of context){const from=(candidate+dy*w+dx)*4;for(let c=0;c<4;c++)error+=(work[at+c]-original[from+c])**2;if(error>=score)return;}if(error<score){score=error;best=candidate;}};
  const stride=Math.max(1,Math.ceil(donors.length/600));for(let i=0;i<donors.length;i+=stride)compare(donors[i]);
  // Refine around the coarse match using only original, clean patches.
  const bx=best%w,by=Math.floor(best/w);for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=bx+dx,y=by+dy;if(x<radius||x>=w-radius||y<radius||y>=h-radius)continue;let clean=true;for(let yy=-radius;yy<=radius&&clean;yy++)for(let xx=-radius;xx<=radius;xx++)if(initial[(y+yy)*w+x+xx]){clean=false;break;}if(clean)compare(y*w+x);}
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const x=tx+dx,y=ty+dy;if(x<0||x>=w||y<0||y>=h)continue;const i=y*w+x;if(hole[i]){const from=best+dy*w+dx;work.set(original.subarray(from*4,from*4+4),i*4);mapping[i]=from;hole[i]=0;remaining--;}}
 }
 // Poisson colour blending keeps donor texture gradients while matching the
 // existing boundary. Solve only on the bounded context image, then carry the
 // low-frequency colour correction to full-resolution donor pixels.
 const blend=Float32Array.from(work),guidance=new Float32Array(size*3),selected:number[]=[];
 for(let i=0;i<size;i++)if(initial[i]){selected.push(i);const x=i%w,y=Math.floor(i/w),from=mapping[i],fx=from%w,fy=Math.floor(from/w);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const donor=Math.max(0,Math.min(h-1,fy+dy))*w+Math.max(0,Math.min(w-1,fx+dx));if(initial[donor])continue;for(let c=0;c<3;c++)guidance[i*3+c]+=original[from*4+c]-original[donor*4+c];}}
 for(let iteration=0;iteration<100;iteration++){let change=0;for(const i of selected){const x=i%w,y=Math.floor(i/w),count=(x?1:0)+(x<w-1?1:0)+(y?1:0)+(y<h-1?1:0);for(let c=0;c<3;c++){const sum=guidance[i*3+c]+(x?blend[(i-1)*4+c]:0)+(x<w-1?blend[(i+1)*4+c]:0)+(y?blend[(i-w)*4+c]:0)+(y<h-1?blend[(i+w)*4+c]:0);const next=sum/count;change=Math.max(change,Math.abs(next-blend[i*4+c]));blend[i*4+c]=next;}}if(change<.08)break;}
 const pixels=source.pixels.slice();for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){const gx=Math.min(w-1,Math.floor(x*w/width)),gy=Math.min(h-1,Math.floor(y*h/height)),at=gy*w+gx,from=mapping[at],sx=Math.max(0,Math.min(width-1,Math.round(x+((from%w)-gx)*width/w))),sy=Math.max(0,Math.min(height-1,Math.round(y+(Math.floor(from/w)-gy)*height/h)));if(!mask[sy*width+sx])pixels.set(source.pixels.subarray((sy*width+sx)*4,(sy*width+sx)*4+4),(y*width+x)*4);else pixels.set(work.subarray(at*4,at*4+4),(y*width+x)*4);for(let c=0;c<3;c++)pixels[(y*width+x)*4+c]+=blend[at*4+c]-work[at*4+c];}
 return {width,height,pixels};
}
