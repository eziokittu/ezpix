import type {Point} from './toolkit.js';
import type {StudioOptions} from './studio.js';
export interface CanvasGuides {x:number[];y:number[];step:number;tolerance:number;snap:boolean;edges:boolean;visible:boolean;rulers:boolean}
export const defaultCanvasGuides=():CanvasGuides=>({x:[],y:[],step:1,tolerance:2,snap:true,edges:false,visible:true,rulers:true});
const whole=(n:number,min:number,max:number,label:string)=>{if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} must be whole and within ${min}-${max}.`);};
export function validateCanvasGuides(input:CanvasGuides,width:number,height:number):CanvasGuides{
 whole(width,1,256,'Width');whole(height,1,256,'Height');if(!input)throw new Error('Guide settings are missing.');whole(input.step,1,32,'Grid step');whole(input.tolerance,0,8,'Snap tolerance');
 for(const key of ['x','y'] as const){const a=input[key];if(!Array.isArray(a)||a.length>16||new Set(a).size!==a.length)throw new Error('Use at most 16 distinct guides on each axis.');a.forEach(n=>whole(n,0,(key==='x'?width:height)-1,'Guide position'));}
 for(const key of ['snap','edges','visible','rulers'] as const)if(typeof input[key]!=='boolean')throw new Error('Guide flags must be Boolean.');return {...input,x:input.x.slice().sort((a,b)=>a-b),y:input.y.slice().sort((a,b)=>a-b)};
}
/** Integer pixel anchors. Equal-distance guide ties choose the lower coordinate. */
export function snapCanvasPoint(point:Point,guides:CanvasGuides,width:number,height:number):Point{
 const g=validateCanvasGuides(guides,width,height);whole(point.x,-1024,1024,'Point X');whole(point.y,-1024,1024,'Point Y');if(!g.snap)return {...point};
 const axis=(value:number,list:number[],size:number)=>{const candidates=[...list,...(g.edges?[0,Math.floor((size-1)/2),size-1]:[])].filter(n=>Math.abs(n-value)<=g.tolerance).sort((a,b)=>Math.abs(a-value)-Math.abs(b-value)||a-b);return Math.max(-1024,Math.min(1024,candidates[0]??Math.floor(value/g.step+0.5)*g.step));};
 return {x:axis(point.x,g.x,width),y:axis(point.y,g.y,height)};
}
export function canvasHandles(width:number,height:number,o:StudioOptions):Point[]{
 whole(width,1,256,'Width');whole(height,1,256,'Height');const cx=(width-1)/2,cy=(height-1)/2,r=Math.max(1,Math.min(width,height)/2-1),round=Math.round;
 if(!o||!Array.isArray(o.points)||o.points.length>64)throw new Error('Use at most 64 control points.');for(const p of o.points){whole(p.x,-1024,1024,'Control X');whole(p.y,-1024,1024,'Control Y');}if(['rotate','shear','offset'].includes(o.kind)){whole(o.amount,-5000,5000,'Transform amount');whole(o.secondaryAmount,-5000,5000,'Second transform amount');}
 if(o.kind==='rotate'){const a=o.amount*Math.PI/180;return [{x:round(cx+r*Math.cos(a)),y:round(cy+r*Math.sin(a))}];}
 if(o.kind==='shear')return [{x:round(cx+o.amount/100*(height-1-cy)),y:height-1},{x:width-1,y:round(cy+o.secondaryAmount/100*(width-1-cx))}];
 if(o.kind==='offset')return [{x:Math.floor(cx)+o.amount,y:Math.floor(cy)+o.secondaryAmount}];return o.points.map(p=>({...p}));
}
export function moveCanvasHandle(width:number,height:number,o:StudioOptions,index:number,point:Point):StudioOptions{
 whole(width,1,256,'Width');whole(height,1,256,'Height');whole(point.x,-1024,1024,'Handle X');whole(point.y,-1024,1024,'Handle Y');const handles=canvasHandles(width,height,o);whole(index,0,handles.length-1,'Handle');const next={...o,layers:o.layers.slice(),points:o.points.map(p=>({...p}))},cx=(width-1)/2,cy=(height-1)/2;
 if(o.kind==='rotate'){if(point.x===cx&&point.y===cy)throw new Error('Move the rotation handle away from the pivot.');next.amount=Math.round(Math.atan2(point.y-cy,point.x-cx)*180/Math.PI);}
 else if(o.kind==='shear'){if(index===0)next.amount=Math.max(-400,Math.min(400,Math.round((point.x-cx)/Math.max(1,height-1-cy)*100)));else next.secondaryAmount=Math.max(-400,Math.min(400,Math.round((point.y-cy)/Math.max(1,width-1-cx)*100)));}
 else if(o.kind==='offset'){next.amount=point.x-Math.floor(cx);next.secondaryAmount=point.y-Math.floor(cy);}
 else next.points[index]={...point};return next;
}
