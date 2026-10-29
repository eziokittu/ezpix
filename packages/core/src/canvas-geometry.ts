import {prepareIndexedGeometry} from './indexed-geometry.js';
import {checkCelBudget,composite,encodeProject,makeLayer,type PixelDocument,type Layer} from './document.js';
import {permuteRaster,rotatedSize,type QuarterTurn} from './raster-transform.js';

export type CanvasAnchor='start'|'center'|'end';
export type CanvasGeometryOptions=
 |{kind:'resize';width:number;height:number;anchorX:CanvasAnchor;anchorY:CanvasAnchor;offsetX:number;offsetY:number}
 |{kind:'crop';x:number;y:number;width:number;height:number}
 |{kind:'scale';width:number;height:number}
 |{kind:'rotate';rotation:Exclude<QuarterTurn,0>}
 |{kind:'flip';axis:'horizontal'|'vertical'}
 |{kind:'trim'};
export interface CanvasGeometryPlan {
 readonly baseline:string;readonly options:Readonly<CanvasGeometryOptions>;
 readonly width:number;readonly height:number;readonly x:number;readonly y:number;
 readonly changed:boolean;readonly clippedPixels:number;readonly historyBytes:number;
 readonly preview:Uint8ClampedArray;
}
function integer(value:number,min:number,max:number,label:string){if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${label} must be a whole number from ${min} to ${max}.`);return value;}
function anchor(value:CanvasAnchor,delta:number){if(!['start','center','end'].includes(value))throw new Error('Choose a start, center or end anchor.');return value==='start'?0:value==='end'?delta:Math.floor(delta/2);}
/** Includes nonzero hidden RGB, hidden/locked layers and every frame, ignoring references/source. */
export function storedArtworkBounds(doc:PixelDocument):{x:number;y:number;width:number;height:number}|null {
 let left=doc.width,top=doc.height,right=-1,bottom=-1;
 if(doc.indexed){for(const c of Object.values(doc.indexed.cels))for(const p of new Set(Object.values(c)))for(let i=0;i<p.length;i++)if(p[i]!==doc.indexed.transparentIndex){const x=i%doc.width,y=Math.floor(i/doc.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};}
 for(const layer of doc.layers){const seen=new Set<Uint8ClampedArray>();for(const frame of doc.frames){const p=layer.cels[frame.id];if(seen.has(p))continue;seen.add(p);for(let i=0;i<p.length;i+=4)if(p[i]||p[i+1]||p[i+2]||p[i+3]){const x=i/4%doc.width,y=Math.floor(i/4/doc.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}}
 return right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};
}
export function resolveCanvasGeometry(doc:PixelDocument,options:CanvasGeometryOptions){
 if(options?.kind==='rotate'){
  if(![90,180,270].includes(options.rotation))throw new Error('Choose 90, 180 or 270 degrees.');
  return {...rotatedSize(doc.width,doc.height,options.rotation),x:0,y:0,options:Object.freeze({kind:'rotate',rotation:options.rotation} as const)};
 }
 if(options?.kind==='flip'){
  if(!['horizontal','vertical'].includes(options.axis))throw new Error('Choose a horizontal or vertical flip.');
  return {width:doc.width,height:doc.height,x:0,y:0,options:Object.freeze({kind:'flip',axis:options.axis} as const)};
 }
 if(options?.kind==='trim'){const bounds=storedArtworkBounds(doc)??{x:0,y:0,width:doc.width,height:doc.height};return {...bounds,options:Object.freeze({kind:'trim'} as const)};}
 if(options?.kind!=='resize'&&options?.kind!=='crop'&&options?.kind!=='scale')throw new Error('Unknown canvas operation.');
 const width=integer(options.width,1,256,'Width'),height=integer(options.height,1,256,'Height');
 if(options.kind==='scale')return {width,height,x:0,y:0,options:Object.freeze({kind:'scale',width,height} as const)};
 if(options.kind==='crop'){
  const x=integer(options.x,0,doc.width-1,'Crop X'),y=integer(options.y,0,doc.height-1,'Crop Y');
  if(x+width>doc.width||y+height>doc.height)throw new Error('Crop rectangle must fit inside the current canvas.');
  return {width,height,x,y,options:Object.freeze({kind:'crop',x,y,width,height} as const)};
 }
 const offsetX=integer(options.offsetX,-256,256,'Offset X'),offsetY=integer(options.offsetY,-256,256,'Offset Y');
 const x=-anchor(options.anchorX,width-doc.width)-offsetX,y=-anchor(options.anchorY,height-doc.height)-offsetY;
 return {width,height,x,y,options:Object.freeze({kind:'resize',width,height,anchorX:options.anchorX,anchorY:options.anchorY,offsetX,offsetY} as const)};
}
/** x/y is the old-canvas coordinate at the new origin. Padding is zero RGBA. */
function transform(pixels:Uint8ClampedArray,oldWidth:number,oldHeight:number,g:{width:number;height:number;x:number;y:number;options?:Readonly<CanvasGeometryOptions>}){
 if(!pixels.length)return new Uint8ClampedArray(0);
 if(g.options?.kind==='rotate')return permuteRaster(pixels,oldWidth,oldHeight,g.width,g.height,g.options.rotation);
 if(g.options?.kind==='flip')return permuteRaster(pixels,oldWidth,oldHeight,g.width,g.height,0,g.options.axis==='horizontal',g.options.axis==='vertical');
 const output=new Uint8ClampedArray(g.width*g.height*4);
 if(g.options?.kind==='scale'){
  // Pixel-center nearest neighbour, exact integer ratios; midpoint ties go upward.
  for(let y=0;y<g.height;y++){const sy=Math.floor((2*y+1)*oldHeight/(2*g.height));for(let x=0;x<g.width;x++){const sx=Math.floor((2*x+1)*oldWidth/(2*g.width)),source=(sy*oldWidth+sx)*4;output.set(pixels.subarray(source,source+4),(y*g.width+x)*4);}}
  return output;
 }
 const left=Math.max(0,g.x),right=Math.min(oldWidth,g.x+g.width),top=Math.max(0,g.y),bottom=Math.min(oldHeight,g.y+g.height);
 if(right>left)for(let y=top;y<bottom;y++)output.set(pixels.subarray((y*oldWidth+left)*4,(y*oldWidth+right)*4),((y-g.y)*g.width+left-g.x)*4);
 return output;
}
export function prepareCanvasGeometry(doc:PixelDocument,options:CanvasGeometryOptions,historyBudget=8*1024*1024):CanvasGeometryPlan {
 if(doc.indexed)return prepareIndexedGeometry(doc,options,historyBudget);
 if(doc.layers.some(l=>l.text||l.adjustment||l.tilemap))throw new Error('Rasterize text and flatten adjustment layers before whole-canvas geometry.');if(doc.slices?.length)throw new Error('Clear sprite slices before changing canvas geometry; existing coordinates are preserved until then.');
 const g=resolveCanvasGeometry(doc,options);checkCelBudget(g.width,g.height,doc.layers.length,doc.frames.length);
 const changed=g.options.kind==='rotate'||g.options.kind==='flip'||g.width!==doc.width||g.height!==doc.height||g.x!==0||g.y!==0;
 let beforeBytes=0,afterBytes=0,clippedPixels=0;
 for(const layer of doc.layers){const seen=new Set<Uint8ClampedArray>();for(const frame of doc.frames){const p=layer.cels[frame.id];if(seen.has(p))continue;seen.add(p);beforeBytes+=p.byteLength;if(p.length)afterBytes+=g.width*g.height*4;
  for(let i=0;i<p.length;i+=4){const x=i/4%doc.width,y=Math.floor(i/4/doc.width);if((g.options.kind==='resize'||g.options.kind==='crop'||g.options.kind==='trim')&&(p[i]||p[i+1]||p[i+2]||p[i+3])&&(x<g.x||y<g.y||x>=g.x+g.width||y>=g.y+g.height))clippedPixels++;}
 }}
 const historyBytes=beforeBytes+afterBytes+doc.layers.reduce((n,l)=>n+(l.effects?.length??0)*256,0)+doc.layers.filter(l=>l.mask).length*(doc.width*doc.height+g.width*g.height)+2*(doc.layers.length+doc.frames.length+doc.groups.length+doc.tags.length)*256+2048;
 if(changed&&(!Number.isFinite(historyBudget)||historyBytes>historyBudget))throw new Error('Canvas operation exceeds the undo memory budget. Use a smaller canvas or fewer stored cels.');
 return Object.freeze({baseline:encodeProject(doc,false),...g,changed,clippedPixels,historyBytes,preview:composite({...doc,width:g.width,height:g.height,layers:canvasGeometryLayers(doc,{...g} as CanvasGeometryPlan)})});
}
/** Rebuild each same-layer buffer once; equal independent buffers stay independent, including empty links. */
export function canvasGeometryLayers(doc:PixelDocument,plan:CanvasGeometryPlan):Layer[]{
 return doc.layers.map(layer=>{const mapped=new Map<Uint8ClampedArray,Uint8ClampedArray>(),cels:Record<string,Uint8ClampedArray>={};
  for(const frame of doc.frames){const p=layer.cels[frame.id];let next=mapped.get(p);if(!next){next=transform(p,doc.width,doc.height,plan);if(next.length&&!next.some(v=>v!==0))next=new Uint8ClampedArray(0);mapped.set(p,next);}cels[frame.id]=next;}
  const next=makeLayer(doc,layer.id,layer.name,layer.visible,cels,layer);if(layer.mask){const rgba=new Uint8ClampedArray(doc.width*doc.height*4);for(let i=0;i<layer.mask.values.length;i++)rgba[i*4]=layer.mask.values[i];const converted=transform(rgba,doc.width,doc.height,plan),values=new Uint8ClampedArray(plan.width*plan.height);for(let i=0;i<values.length;i++)values[i]=converted[i*4];next.mask={enabled:layer.mask.enabled,values};}return next;
 });
}
