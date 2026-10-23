import {encodeProject,type PixelDocument} from './document.js';
import {validateReferences,type ReferenceImage} from './references.js';
import {permuteRaster} from './raster-transform.js';
export type ReferenceTransform={kind:'rotate';rotation:90|180|270}|{kind:'flip';axis:'horizontal'|'vertical'}|{kind:'scale';width:number;height:number}|{kind:'crop';x:number;y:number;width:number;height:number};
export interface ReferenceTransformPlan {readonly baseline:string;readonly image:ReferenceImage;readonly changed:boolean;readonly historyBytes:number}
const plans=new WeakMap<ReferenceTransformPlan,{id:string;options:ReferenceTransform}>();
export function prepareReferenceTransform(doc:PixelDocument,id:string,input:ReferenceTransform,budget=8*1024*1024):ReferenceTransformPlan {
 const r=doc.references.find(r=>r.id===id),o=structuredClone(input);if(!r)throw new Error('Reference is missing.');
 let w=r.width,h=r.height,p:Uint8ClampedArray;
 if(o.kind==='rotate'||o.kind==='flip'){
  if(o.kind==='rotate'&&![90,180,270].includes(o.rotation)||o.kind==='flip'&&!['horizontal','vertical'].includes(o.axis))throw new Error('Invalid reference transform.');
  if(o.kind==='rotate'&&o.rotation!==180)[w,h]=[h,w];p=permuteRaster(r.pixels,r.width,r.height,w,h,o.kind==='rotate'?o.rotation:0,o.kind==='flip'&&o.axis==='horizontal',o.kind==='flip'&&o.axis==='vertical');
 }else if(o.kind==='scale'||o.kind==='crop'){
  w=o.width;h=o.height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>1024||h>1024)throw new Error('Reference dimensions must be 1-1024.');
  if(o.kind==='crop'&&(!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x+w>r.width||o.y+h>r.height))throw new Error('Reference crop must fit.');
  p=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=o.kind==='crop'?x+o.x:Math.floor((x+.5)*r.width/w),sy=o.kind==='crop'?y+o.y:Math.floor((y+.5)*r.height/h),i=(sy*r.width+sx)*4;p.set(r.pixels.subarray(i,i+4),(y*w+x)*4);}
 }else throw new Error('Choose a reference transform.');
 const image={...r,width:w,height:h,pixels:p},references=doc.references.map(q=>q.id===id?image:q);validateReferences({references,activeReferenceId:doc.activeReferenceId});
 const historyBytes=doc.references.reduce((n,q)=>n+q.pixels.byteLength,0)+p.byteLength+references.length*512;
 const changed=w!==r.width||h!==r.height||p.some((v,i)=>v!==r.pixels[i]);if(changed&&historyBytes>budget)throw new Error('Reference transform exceeds undo memory budget.');
 const plan=Object.freeze({baseline:encodeProject(doc,false),get image(){return {...image,pixels:p.slice()};},changed,historyBytes});plans.set(plan,{id,options:o});return plan;
}
export function regenerateReferenceTransform(doc:PixelDocument,plan:ReferenceTransformPlan,budget:number){const stored=plans.get(plan);if(!stored||plan.baseline!==encodeProject(doc,false))throw new Error('Reference source changed. Prepare again.');return prepareReferenceTransform(doc,stored.id,stored.options,budget);}
