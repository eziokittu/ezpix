import {composite,encodeProject,rasterCel,makeLayer,validateDuration,type PixelDocument,type RGBA,type Layer} from './document.js';
import {layerEditable} from './groups.js';
import {type Point} from './toolkit.js';
export const STUDIO_KINDS=['polygon','curve','gradient','rotate','shear','perspective','offset','outline','shadow','alpha','cels','timing','sequence'] as const;
export type StudioKind=typeof STUDIO_KINDS[number];
export interface StudioOptions {
 kind:StudioKind; layers:string[]; from:number;to:number;
 points:Point[];color:RGBA;secondary:RGBA;filled:boolean;over:boolean;
 amount:number;secondaryAmount:number;radius:number;wrap:boolean;
 variant:string;
}
export function defaultStudioOptions(doc:PixelDocument,kind:StudioKind='polygon'):StudioOptions{return {kind,layers:[doc.activeLayerId],from:doc.frames.findIndex(f=>f.id===doc.activeFrameId),to:doc.frames.findIndex(f=>f.id===doc.activeFrameId),points:kind==='gradient'?[{x:0,y:0},{x:Math.max(1,doc.width-1),y:doc.height-1}]:kind==='perspective'?[{x:0,y:0},{x:doc.width,y:0},{x:doc.width,y:doc.height},{x:0,y:doc.height}]:[{x:0,y:0},{x:doc.width-1,y:0},{x:doc.width-1,y:doc.height-1},{x:0,y:doc.height-1}],color:[57,255,20,255],secondary:[0,0,0,0],filled:true,over:true,amount:kind==='timing'?100:kind==='rotate'?30:1,secondaryAmount:0,radius:1,wrap:false,variant:kind==='gradient'?'linear':kind==='alpha'?'dilate':kind==='cels'?'clear':kind==='timing'?'set':kind==='sequence'?'reverse':'default'};}
export interface StudioPlan {readonly baseline:string;readonly options:StudioOptions;readonly changed:boolean;readonly affectedCels:number;readonly outsideLinks:number;readonly historyBytes:number;readonly frames:ReadonlyArray<{readonly id:string;readonly duration:number}>;readonly preview:Uint8ClampedArray}
const plans=new WeakMap<StudioPlan,StudioOptions>();
const round=(value:number)=>Math.floor(value+0.5+1e-10);
const integer=(v:number,min:number,max:number,label:string)=>{if(!Number.isInteger(v)||v<min||v>max)throw new Error(`${label} must be a whole number from ${min} to ${max}.`);};
function validated(doc:PixelDocument,input:StudioOptions):StudioOptions{
 if(!input||!STUDIO_KINDS.includes(input.kind))throw new Error('Choose a studio operation.');
 const o={...input,layers:input.layers?.slice(),points:input.points?.map(p=>({...p})),color:input.color?.slice() as unknown as RGBA,secondary:input.secondary?.slice() as unknown as RGBA};
 if(!Array.isArray(o.layers)||!o.layers.length||new Set(o.layers).size!==o.layers.length||o.layers.some(id=>!doc.layers.some(l=>l.id===id)))throw new Error('Select existing, distinct artwork layers.');
 integer(o.from,0,doc.frames.length-1,'First frame');integer(o.to,o.from,doc.frames.length-1,'Last frame');
 for(const c of [o.color,o.secondary]){if(!Array.isArray(c)||c.length!==4)throw new Error('Use four RGBA bytes.');c.forEach(v=>integer(v,0,255,'RGBA'));}
 if(!Array.isArray(o.points)||o.points.length>64||o.points.some(p=>!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||Math.abs(p.x)>1024||Math.abs(p.y)>1024))throw new Error('Use at most 64 whole-coordinate points within -1024 to 1024.');
 if(!['filled','over','wrap'].every(k=>typeof o[k as 'filled']==='boolean'))throw new Error('Drawing flags must be Boolean.');
 integer(o.amount,-5000,5000,'Amount');integer(o.secondaryAmount,-5000,5000,'Second amount');integer(o.radius,1,16,'Radius');
 const variants:Partial<Record<StudioKind,string[]>>={gradient:['linear','radial','diamond'],alpha:['dilate','erode','threshold'],cels:['clear','copy','unlink'],timing:['set','scale'],sequence:['reverse','pingpong','repeat']};
 if(variants[o.kind]&&!variants[o.kind]!.includes(o.variant))throw new Error('Choose a supported operation mode.');
 if(o.kind==='polygon'&&o.points.length<3||o.kind==='curve'&&![3,4].includes(o.points.length)||o.kind==='gradient'&&o.points.length<2||o.kind==='perspective'&&o.points.length!==4)throw new Error('Polygon needs 3-64 vertices; curves 3 or 4 controls; gradient 2 anchors; perspective 4 corners.');
 if(o.kind==='shear'&&(Math.abs(o.amount)>400||Math.abs(o.secondaryAmount)>400||Math.abs(1-o.amount*o.secondaryAmount/10000)<0.01))throw new Error('Shears need -400 to 400 percent and a nonsingular transform.');
 if(o.kind==='rotate'&&Math.abs(o.amount)>360)throw new Error('Rotation must be -360 to 360 degrees.');
 if(o.kind==='alpha'&&o.variant==='threshold')integer(o.amount,0,255,'Alpha threshold');
 if(o.kind==='sequence'&&o.variant==='repeat')integer(o.amount,1,8,'Repeat count');
 if(o.kind==='timing'&&o.variant==='scale')integer(o.amount,1,1000,'Duration percent');
 if(!['timing','sequence'].includes(o.kind)&&o.layers.some(id=>!layerEditable(doc,doc.layers.find(l=>l.id===id)!)))throw new Error('Show and unlock every selected layer and its groups.');
 return o;
}
function blend(dst:Uint8ClampedArray,i:number,c:RGBA,over:boolean){if(!over){dst.set(c,i);return;}const a=c[3]*255,b=dst[i+3]*(255-c[3]),out=a+b;if(!out)return;for(let k=0;k<3;k++){const n=c[k]*a+dst[i+k]*b;dst[i+k]=Math.floor((2*n+out)/(2*out));}dst[i+3]=Math.floor((2*out+255)/510);}

function homography(points:Point[],width:number,height:number){
 // Solve destination-to-source projective mapping with bounded partial pivoting.
 const src=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}],m:number[][]=[];
 let direction=0;for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(!cross||direction&&Math.sign(cross)!==direction)throw new Error('Perspective corners must form a strictly convex ordered quadrilateral.');direction=Math.sign(cross);const {x,y}=a,u=src[i].x,v=src[i].y;m.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
 for(let col=0;col<8;col++){let pivot=col;for(let row=col+1;row<8;row++)if(Math.abs(m[row][col])>Math.abs(m[pivot][col]))pivot=row;if(Math.abs(m[pivot][col])<1e-10)throw new Error('Perspective transform is singular.');[m[col],m[pivot]]=[m[pivot],m[col]];const factor=m[col][col];for(let j=col;j<9;j++)m[col][j]/=factor;for(let row=0;row<8;row++)if(row!==col){const f=m[row][col];for(let j=col;j<9;j++)m[row][j]-=f*m[col][j];}}
 return m.map(row=>row[8]);
}
/** Authored integer raster drawing and nearest-neighbour transforms; fixed canvas clips output. */
function studioRaster(source:Uint8ClampedArray,w:number,h:number,o:StudioOptions):Uint8ClampedArray{
 const before=source.length?source:new Uint8ClampedArray(w*h*4),out=before.slice(),at=(x:number,y:number)=>(y*w+x)*4,put=(x:number,y:number,c:RGBA=o.color)=>{if(x>=0&&x<w&&y>=0&&y<h)blend(out,at(x,y),c,o.over);};
 const sample=(x:number,y:number)=>{if(o.wrap){x=(x%w+w)%w;y=(y%h+h)%h;}return x>=0&&x<w&&y>=0&&y<h?at(x,y):-1;};
 if(o.kind==='polygon'||o.kind==='curve'){
  const seen=new Set<number>(),mark=(p:Point)=>{if(p.x>=0&&p.x<w&&p.y>=0&&p.y<h)seen.add(p.y*w+p.x);},line=(a:Point,b:Point)=>{let {x,y}=a;const dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let err=dx+dy;for(;;){mark({x,y});if(x===b.x&&y===b.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}};
  if(o.kind==='polygon'){for(let i=0;i<o.points.length;i++)line(o.points[i],o.points[(i+1)%o.points.length]);if(o.filled)for(let y=0;y<h;y++)for(let x=0;x<w;x++){let inside=false;for(let i=0,j=o.points.length-1;i<o.points.length;j=i++){const a=o.points[i],b=o.points[j];if((a.y>y+0.5)!==(b.y>y+0.5)&&x+0.5<(b.x-a.x)*(y+0.5-a.y)/(b.y-a.y)+a.x)inside=!inside;}if(inside)seen.add(y*w+x);}}
  else{const p=o.points,steps=Math.min(8192,Math.max(32,Math.ceil(p.slice(1).reduce((s,b,i)=>s+Math.hypot(b.x-p[i].x,b.y-p[i].y),0)*4)));let last=p[0];for(let i=1;i<=steps;i++){const t=i/steps,s=1-t,coeff=p.length===3?[s*s,2*s*t,t*t]:[s*s*s,3*s*s*t,3*s*t*t,t*t*t],next={x:Math.floor(p.reduce((n,v,k)=>n+coeff[k]*v.x,0)+0.5),y:Math.floor(p.reduce((n,v,k)=>n+coeff[k]*v.y,0)+0.5)};line(last,next);last=next;}}
  for(const p of seen)put(p%w,Math.floor(p/w));return out;
 }
 if(o.kind==='gradient'){
  const [a,b]=o.points,dx=b.x-a.x,dy=b.y-a.y,dist=dx*dx+dy*dy;if(!dist)throw new Error('Gradient anchors must differ.');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const denominator=o.variant==='linear'?dist:o.variant==='diamond'?Math.abs(dx)+Math.abs(dy):1,numerator=o.variant==='linear'?(x-a.x)*dx+(y-a.y)*dy:o.variant==='diamond'?Math.abs(x-a.x)+Math.abs(y-a.y):Math.hypot(x-a.x,y-a.y)/Math.sqrt(dist),n=Math.max(0,Math.min(denominator,numerator)),m=denominator-n,alpha=o.color[3]*m+o.secondary[3]*n;
   const c=[0,0,0,round(alpha/denominator)];for(let k=0;k<3;k++)c[k]=round(alpha?(o.color[k]*o.color[3]*m+o.secondary[k]*o.secondary[3]*n)/alpha:(o.color[k]*m+o.secondary[k]*n)/denominator);put(x,y,c as unknown as RGBA);
  }return out;
 }
 if(['rotate','shear','perspective','offset'].includes(o.kind)){
  out.fill(0);const cx=(w-1)/2,cy=(h-1)/2,angle=o.amount*Math.PI/180,cos=o.amount%90===0?[1,0,-1,0][((o.amount/90)%4+4)%4]:Math.cos(angle),sin=o.amount%90===0?[0,1,0,-1][((o.amount/90)%4+4)%4]:Math.sin(angle),sx=o.amount/100,sy=o.secondaryAmount/100,det=1-sx*sy,H=o.kind==='perspective'?homography(o.points,w,h):[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let u=x,v=y;if(o.kind==='rotate'){u=cos*(x-cx)+sin*(y-cy)+cx;v=-sin*(x-cx)+cos*(y-cy)+cy;}else if(o.kind==='shear'){u=((x-cx)-sx*(y-cy))/det+cx;v=((y-cy)-sy*(x-cx))/det+cy;}else if(o.kind==='offset'){u=x-o.amount;v=y-o.secondaryAmount;}else{const X=x+0.5,Y=y+0.5,den=H[6]*X+H[7]*Y+1;if(Math.abs(den)<1e-10)continue;u=(H[0]*X+H[1]*Y+H[2])/den-0.5;v=(H[3]*X+H[4]*Y+H[5])/den-0.5;}
   if(o.kind==='perspective'){const sides=o.points.map((a,i)=>{const b=o.points[(i+1)%4];return (b.x-a.x)*(y+0.5-a.y)-(b.y-a.y)*(x+0.5-a.x);});if(sides.some(v=>v>1e-9)&&sides.some(v=>v< -1e-9))continue;}
   const i=sample(round(u),round(v));if(i>=0)out.set(before.subarray(i,i+4),at(x,y));}return out;
 }
 if(o.kind==='outline'||o.kind==='alpha'){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=at(x,y);if(o.kind==='alpha'&&o.variant==='threshold'){out[i+3]=before[i+3]>=o.amount?255:0;continue;}let high=0,low=255,nearest=-1,best=Infinity;for(let yy=-o.radius;yy<=o.radius;yy++)for(let xx=-o.radius;xx<=o.radius;xx++){if(Math.abs(xx)+Math.abs(yy)>o.radius)continue;const j=sample(x+xx,y+yy),alpha=j<0?0:before[j+3],distance=Math.abs(xx)+Math.abs(yy);if(alpha>high||alpha===high&&distance<best){high=alpha;nearest=j;best=distance;}low=Math.min(low,alpha);}
   if(o.kind==='outline'){if(!before[i+3]&&high)put(x,y,[o.color[0],o.color[1],o.color[2],Math.floor(high*o.color[3]/255+0.5)]);}else if(o.variant==='erode')out[i+3]=low;else{if(nearest>=0&&!before[i+3])out.set(before.subarray(nearest,nearest+3),i);out[i+3]=high;}}
  return out;
 }
 if(o.kind==='shadow'){
  out.fill(0);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=sample(x-o.amount,y-o.secondaryAmount);if(j>=0){const a=Math.floor(before[j+3]*o.color[3]/255+0.5);if(a)out.set([o.color[0],o.color[1],o.color[2],a],at(x,y));}}
  for(let i=0;i<before.length;i+=4){if(!out[i+3]&&!before[i+3])out.set(before.subarray(i,i+4),i);else blend(out,i,[before[i],before[i+1],before[i+2],before[i+3]],true);}return out;
 }
 return out;
}
function result(doc:PixelDocument,o:StudioOptions){
 const chosen=doc.frames.slice(o.from,o.to+1).map(f=>f.id),selected=new Set(chosen);let affectedCels=0,outsideLinks=0;
 const layers=doc.layers.map(l=>{if(!o.layers.includes(l.id)||['timing','sequence'].includes(o.kind))return makeLayer(doc,l.id,l.name,l.visible,{...l.cels},l);const cels={...l.cels},mapped=new Map<Uint8ClampedArray,Uint8ClampedArray>();
  for(const id of chosen){const before=l.cels[id];if(o.kind==='cels'&&o.variant==='unlink'){const next=before.slice();cels[id]=next;affectedCels++;continue;}if(mapped.has(before))continue;let next:Uint8ClampedArray;
   if(o.kind==='cels')next=o.variant==='clear'?new Uint8ClampedArray(0):rasterCel(doc,l).slice();else next=studioRaster(before,doc.width,doc.height,o);
   if(!next.some(v=>v!==0))next=new Uint8ClampedArray(0);mapped.set(before,next);affectedCels++;
   // Copy detaches selected targets; other raster operations deliberately preserve links.
   for(const f of doc.frames)if(l.cels[f.id]===before&&(o.kind!=='cels'||o.variant!=='copy'||selected.has(f.id))){cels[f.id]=next;if(!selected.has(f.id))outsideLinks++;}
  }return makeLayer(doc,l.id,l.name,l.visible,cels,l);
 });
 let frames=doc.frames.map(f=>({...f}));const tags=doc.tags.map(t=>({...t}));
 if(o.kind==='timing')for(let i=o.from;i<=o.to;i++){const duration=o.variant==='set'?o.amount:Math.floor(frames[i].duration*o.amount/100+0.5);validateDuration(duration);frames[i].duration=duration;}
 if(o.kind==='sequence'){
  if(o.variant==='reverse')frames.splice(o.from,chosen.length,...frames.slice(o.from,o.to+1).reverse());
  else{const source=o.variant==='pingpong'?doc.frames.slice(o.from+1,o.to).reverse():Array.from({length:o.amount-1},()=>doc.frames.slice(o.from,o.to+1)).flat();if(frames.length+source.length>32)throw new Error('Sequence exceeds 32 frames.');if(doc.width*doc.height*layers.length*(frames.length+source.length)*4>4*1024*1024)throw new Error('Sequence exceeds the 4 MiB cel budget.');
   const used=new Set(frames.map(f=>f.id));let n=1;const extra=source.map(f=>{while(used.has(`frame-${n}`))n++;const id=`frame-${n}`;used.add(id);for(let i=0;i<layers.length;i++)layers[i].cels[id]=doc.layers[i].cels[f.id];return {id,duration:f.duration};});frames.splice(o.to+1,0,...extra);for(const t of tags){if(t.from>o.to)t.from+=extra.length;if(t.to>=o.to)t.to+=extra.length;}}
 }
 const output={...doc,layers,frames,tags};
 const before=encodeProject(doc,false),after=encodeProject(output,false),linkChange=layers.some((l,i)=>{const a=Object.values(doc.layers[i].cels),b=Object.values(l.cels);return a.some((p,j)=>a.some((q,k)=>(p===q)!==(b[j]===b[k])));});
 const buffers=new Set([...doc.layers,...layers].flatMap(l=>Object.values(l.cels))),historyBytes=[...buffers].reduce((n,p)=>n+p.byteLength,0)+(doc.layers.length+layers.length+doc.frames.length+frames.length+2*(doc.groups.length+doc.tags.length))*256;
 return {layers,frames,tags,changed:before!==after||linkChange,affectedCels,outsideLinks,historyBytes,preview:composite(output)};
}
export function prepareStudio(doc:PixelDocument,input:StudioOptions,historyBudget=8*1024*1024):StudioPlan{
 const o=validated(doc,input),count=doc.layers.filter(l=>o.layers.includes(l.id)).reduce((n,l)=>n+new Set(doc.frames.slice(o.from,o.to+1).map(f=>l.cels[f.id])).size,0),visits=count*(doc.width*doc.height*(o.kind==='outline'||o.kind==='alpha'&&o.variant!=='threshold'?1+2*o.radius*(o.radius+1):o.kind==='polygon'?o.points.length:1)+(o.kind==='polygon'?o.points.reduce((n,p,i)=>{const q=o.points[(i+1)%o.points.length];return n+1+Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y));},0):0));
 if(visits>32*1024*1024)throw new Error('Studio work exceeds 32 million visits. Reduce radius, frame range or layers.');
 const r=result(doc,o);if(!Number.isFinite(historyBudget)||historyBudget<0||r.changed&&r.historyBytes>historyBudget)throw new Error('Studio operation exceeds the undo memory budget.');
 const plan=Object.freeze({baseline:encodeProject(doc,false),get options(){return structuredClone(o);},changed:r.changed,affectedCels:r.affectedCels,outsideLinks:r.outsideLinks,historyBytes:r.historyBytes,get frames(){return r.frames.map(f=>({...f}));},get preview(){return r.preview.slice();}});plans.set(plan,o);return plan;
}
export function regenerateStudio(doc:PixelDocument,plan:StudioPlan,budget:number){const o=plans.get(plan);if(!o||plan.baseline!==encodeProject(doc,false))throw new Error('Studio source changed. Prepare again.');const fresh=prepareStudio(doc,o,budget);return {...result(doc,o),changed:fresh.changed};}
export interface OnionOptions {before:number;after:number;opacity:number;falloff:number;wrap:boolean;previous:RGBA;next:RGBA;}
/** Display-only tinted ghosts, far frames first. Current frame never enters the ghost buffer. */
export function expandedOnion(doc:PixelDocument,o:OnionOptions):Uint8ClampedArray{
 integer(o.before,0,8,'Previous ghosts');integer(o.after,0,8,'Next ghosts');integer(o.opacity,0,100,'Ghost opacity');integer(o.falloff,0,100,'Ghost falloff');for(const c of [o.previous,o.next]){if(!Array.isArray(c)||c.length!==4)throw new Error('Ghost colours need RGBA bytes.');c.forEach(v=>integer(v,0,255,'Ghost RGBA'));}if(typeof o.wrap!=='boolean')throw new Error('Ghost wrap must be Boolean.');const out=new Uint8ClampedArray(doc.width*doc.height*4),at=doc.frames.findIndex(f=>f.id===doc.activeFrameId),seen=new Set<number>([at]);
 const ghosts:{index:number;distance:number;colour:RGBA}[]=[];for(let distance=1;distance<=Math.max(o.before,o.after);distance++)for(const direction of [-1,1]){if(distance>(direction<0?o.before:o.after))continue;let index=at+direction*distance;if(o.wrap)index=(index%doc.frames.length+doc.frames.length)%doc.frames.length;if(index<0||index>=doc.frames.length||seen.has(index))continue;seen.add(index);ghosts.push({index,distance,colour:direction<0?o.previous:o.next});}
 for(const g of ghosts.reverse()){const p=composite(doc,doc.frames[g.index].id),factor=o.opacity/100*Math.pow(o.falloff/100,g.distance-1);for(let i=0;i<p.length;i+=4)blend(out,i,[g.colour[0],g.colour[1],g.colour[2],Math.floor(p[i+3]*factor*g.colour[3]/255+0.5)],true);}return out;
}
