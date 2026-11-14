/** Display-only contour. Actual selection membership is never resampled or changed. */
export function selectionContour(mask:Uint8Array,width:number,height:number){
 const step=Math.max(1,Math.ceil(Math.max(width,height)/512)),w=Math.ceil(width/step),h=Math.ceil(height/step);
 const selected=(x:number,y:number)=>x>=0&&y>=0&&x<w&&y<h&&!!mask[Math.min(height-1,y*step)*width+Math.min(width-1,x*step)];
 // Directed edges keep selected cells to their right: outside loops march clockwise.
 const edges=new Map<number,number[]>(),stride=w+1;
 const edge=(x:number,y:number,nx:number,ny:number)=>{const key=y*stride+x,list=edges.get(key)??[];list.push(ny*stride+nx);edges.set(key,list);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(selected(x,y)){if(!selected(x,y-1))edge(x,y,x+1,y);if(!selected(x+1,y))edge(x+1,y,x+1,y+1);if(!selected(x,y+1))edge(x+1,y+1,x,y+1);if(!selected(x-1,y))edge(x,y+1,x,y);}
 const parts:string[]=[];while(edges.size){const start=edges.keys().next().value!;let key=start,dx=1,dy=0;parts.push(`M${key%stride} ${Math.floor(key/stride)}`);do{const candidates=edges.get(key);if(!candidates?.length)break;let index=candidates.findIndex(next=>{const nx=next%stride-key%stride,ny=Math.floor(next/stride)-Math.floor(key/stride);return nx===-dy&&ny===dx;});if(index<0)index=0;const next=candidates.splice(index,1)[0];if(!candidates.length)edges.delete(key);dx=next%stride-key%stride;dy=Math.floor(next/stride)-Math.floor(key/stride);parts.push(`l${dx} ${dy}`);key=next;}while(key!==start);parts.push('Z');}
 return {path:parts.join(''),width:w,height:h};
}
export function mountSelectionOutline(canvases:HTMLCanvasElement[],read:()=>{mask:Uint8Array|null;width:number;height:number;enabled:boolean}){
 const overlays=canvases.map(()=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('ez-selection-outline');svg.setAttribute('aria-hidden','true');svg.setAttribute('preserveAspectRatio','none');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);return svg;});
 let previous:Uint8Array|null|undefined,contour:ReturnType<typeof selectionContour>|undefined;
 const refresh=()=>{const state=read();if(state.mask!==previous){previous=state.mask;contour=state.mask?selectionContour(state.mask,state.width,state.height):undefined;}
  overlays.forEach((svg,index)=>{const canvas=canvases[index],show=state.enabled&&!!contour&&!!canvas.parentElement&&!canvas.parentElement.hidden;svg.style.display=show?'block':'none';if(!show)return;if(svg.parentElement!==canvas.parentElement)canvas.parentElement!.append(svg);const r=canvas.getBoundingClientRect(),p=canvas.parentElement!.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${contour!.width} ${contour!.height}`);svg.firstElementChild!.setAttribute('d',contour!.path);svg.style.cssText=`position:absolute;pointer-events:none;z-index:9;left:${r.left-p.left}px;top:${r.top-p.top}px;width:${r.width}px;height:${r.height}px`;});};
 const resize=new ResizeObserver(refresh);canvases.forEach(c=>resize.observe(c));return {refresh,dispose(){resize.disconnect();overlays.forEach(svg=>svg.remove());}};
}
