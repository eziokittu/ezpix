import test from 'node:test';
import assert from 'node:assert/strict';
import {smartRemove} from '../dist/smart-remove.js';
import {PIXEL_SHAPES,shapedPixels} from '../dist/pixel-shapes.js';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {clonePhoto} from '../dist/photo-lab.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
const image=(w=48,h=32)=>({width:w,height:h,pixels:Uint8ClampedArray.from(Array.from({length:w*h},(_,i)=>[(i%w)%8<4?42:140,Math.floor(i/w)%8<4?80:160,130,255]).flat())});
test('every new pixel pattern completely tiles odd and asymmetric canvases',()=>{
 assert.ok(!PIXEL_SHAPES.includes('circle'));assert.ok(!PIXEL_SHAPES.includes('octagon'));assert.ok(PIXEL_SHAPES.length>=12);
 for(const [w,h]of [[47,31],[31,47],[13,7]])for(const shape of PIXEL_SHAPES){const source=image(w,h),result=shapedPixels(source,{kind:'mosaic',shape,columns:7,rows:4,gap:0});assert.equal(result.width,w);for(let i=3;i<result.pixels.length;i+=4)assert.equal(result.pixels[i],255,shape+' at '+i);}
});
test('Smart Remove uses clean image context, preserves exact outside pixels, roundtrips and undoes',()=>{
 const source=image(),mask=new Uint8Array(48*32);for(let y=12;y<20;y++)for(let x=20;x<28;x++){mask[y*48+x]=1;source.pixels.set([255,0,0,255],(y*48+x)*4);}const before=structuredClone(source),filled=smartRemove(source,mask);assert.deepEqual(smartRemove(source,mask),filled);assert.deepEqual(source,before);
 for(let i=0;i<mask.length;i++){if(mask[i])assert.notEqual(filled.pixels[i*4],255);else assert.deepEqual(filled.pixels.slice(i*4,i*4+4),source.pixels.slice(i*4,i*4+4));}
 const ws=new PhotoWorkspace([source],true);ws.append({kind:'patch',image:filled,mask},'Smart Remove');assert.deepEqual(ws.render()[0],filled);const saved=decodePhotoProject(encodePhotoProject(ws.snapshot()));const opened=new PhotoWorkspace(saved.original);opened.restore(saved);assert.equal(opened.undoEdit(),false);ws.undoEdit();assert.deepEqual(ws.render()[0],source);
 assert.throws(()=>smartRemove(source,new Uint8Array(mask.length)),/Select/);assert.throws(()=>smartRemove(source,new Uint8Array(mask.length).fill(1)),/smaller/);
});
test('more than ten mixed edits undo to import, while reopening preserves the saved baseline',()=>{
 const source=image(8,8),ws=new PhotoWorkspace([source],true);for(let i=0;i<35;i++)ws.mutate(ws.active,'rename','Edit '+i);assert.equal(ws.history().steps,35);for(let i=0;i<35;i++)assert.equal(ws.undoEdit(),true);assert.equal(ws.undoEdit(),false);assert.deepEqual(ws.render()[0],source);for(let i=0;i<35;i++)ws.redoEdit();const snapshot=ws.snapshot(),opened=new PhotoWorkspace(snapshot.original);opened.restore(snapshot);opened.mutate(opened.active,'rename','New session');opened.undoEdit();assert.equal(opened.layers()[0].name,'Edit 34');assert.equal(opened.undoEdit(),false);
});
test('Smart Remove blending never samples colour gradients from the object being removed',()=>{
 const width=48,height=32,pixels=new Uint8ClampedArray(width*height*4),mask=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.set([30+x*3,40+y*4,100,255],(y*width+x)*4);
 const clean=pixels.slice();for(let y=12;y<20;y++)for(let x=20;x<28;x++){mask[y*width+x]=1;pixels.set([255,0,255,255],(y*width+x)*4);}
 const output=smartRemove({width,height,pixels},mask);let error=0;for(let i=0;i<mask.length;i++)if(mask[i]){for(let c=0;c<3;c++)error+=Math.abs(output.pixels[i*4+c]-clean[i*4+c]);assert.ok(Math.abs(output.pixels[i*4+2]-100)<=1);}
 assert.ok(error/(64*3)<12,'filled gradient should match the surrounding background, not the removed object');
});
test('Repair scales and rotates an independent sample while preserving custom target membership',()=>{
 const source=image(),mask=new Uint8Array(48*32);for(let y=14;y<19;y++)for(let x=32;x<38;x++)if((x+y)%2)mask[y*48+x]=1;
 const edit={kind:'clone',sourceX:.2,sourceY:.3,x:.73,y:.5,radius:.2,aspect:1.4,angle:0,sourceRadius:.1,sourceAspect:.7,sourceAngle:30,sourceShape:'rectangle',shape:'rectangle',softness:0,targetMask:mask};const result=clonePhoto(source,edit);let changed=0;for(let i=0;i<mask.length;i++){if(!mask[i])assert.deepEqual(result.pixels.slice(i*4,i*4+4),source.pixels.slice(i*4,i*4+4));else if(result.pixels.slice(i*4,i*4+4).some((v,c)=>v!==source.pixels[i*4+c]))changed++;}assert.ok(changed>0);assert.throws(()=>clonePhoto(source,{...edit,sourceMask:new Uint8Array(3)}));
});
