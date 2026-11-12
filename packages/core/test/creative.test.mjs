import test from 'node:test';import assert from 'node:assert/strict';
import {editPhoto,editPhotoFrames} from '../dist/photo-edit.js';
import {createConversionProcessor} from '../dist/worker.js';
import {defaultRecipe,defaultFocusAdjustments,createDocument,captureSelection,combineSelectionMasks,advancedSelectionMask,transformSelection} from '../dist/index.js';
const image=(w=8,h=8)=>({width:w,height:h,pixels:Uint8ClampedArray.from({length:w*h*4},(_,i)=>i%4===3?255:(i*13)%256)});
test('photo mode bypasses pixel conversion, retaining source resolution and exact pixels',()=>{
 const source=image(600,400),process=createConversionProcessor(),options={rect:{x:0,y:0,width:600,height:400},method:'crop',tolerance:0,adjustments:defaultFocusAdjustments()};
 const result=process({recipe:defaultRecipe(source),focus:{frames:[source],options,fps:4,track:false,photo:true}});
 assert.equal(result.width,600);assert.equal(result.height,400);assert.deepEqual(result.photo.pixels,source.pixels);
 const pixel=process({recipe:{...defaultRecipe(source),width:24,height:16},focus:{options,fps:4,track:false}});assert.equal(pixel.width,24);assert.equal(typeof pixel.project,'string');
});
test('sticker stamps blend alpha, rotate, clip and leave both input buffers intact',()=>{
 const source={width:5,height:5,pixels:new Uint8ClampedArray(100)},sticker={width:2,height:2,pixels:new Uint8ClampedArray([255,0,0,255,0,255,0,128,0,0,255,255,255,255,255,255])};const before=sticker.pixels.slice();
 const out=editPhoto(source,{kind:'stamp',image:sticker,x:.5,y:.5,size:.8,angle:90,opacity:.5});assert.ok(out.pixels.some(v=>v));assert.ok(out.pixels.some((v,i)=>i%4===3&&v===128));assert.deepEqual(sticker.pixels,before);assert.ok(source.pixels.every(v=>!v));
 const edge=editPhoto(source,{kind:'stamp',image:sticker,x:0,y:0,size:1,angle:-45,opacity:1});assert.equal(edge.pixels.length,100);
 assert.throws(()=>editPhoto(source,{kind:'stamp',image:sticker,x:3,y:0,size:1,angle:0,opacity:1}),/bounds/);
});
test('freehand paths, smooth resizing and all concealment styles are bounded immutable edits',()=>{
 const source=image(),before=source.pixels.slice();const drawn=editPhoto(source,{kind:'draw',points:[{x:0,y:0},{x:1,y:1}],size:.1,color:[255,20,30,255]});assert.deepEqual([...drawn.pixels.slice(0,4)],[255,20,30,255]);
 for(const style of ['solid','blur','pixelate']){const out=editPhoto(source,{kind:'redact',style,x:.5,y:.5,width:.5,height:.5});assert.notDeepEqual(out.pixels,source.pixels);assert.deepEqual(out.pixels.slice(0,4),source.pixels.slice(0,4));}
 const scaled=editPhoto(source,{kind:'resize',width:4,height:6,sampling:'smooth'});assert.equal(scaled.width,4);assert.equal(scaled.height,6);assert.deepEqual(source.pixels,before);
 assert.throws(()=>editPhoto(source,{kind:'resize',width:9000,height:9000,sampling:'smooth'}),/megapixels/);
 assert.throws(()=>editPhotoFrames([source],{kind:'draw',points:[],size:.1,color:[1,2,3,255]}),/drawing/);
});
test('rectangle minus brush plus lasso is one persistent selection with exact holes',()=>{
 const doc=createDocument(16,16),base=captureSelection(doc,{x:0,y:0,width:16,height:16});doc.cel.pixels.fill(255);
 const rect=advancedSelectionMask(base,{kind:'shape',shape:'rectangle',x:1,y:1,width:8,height:8});
 const brush=advancedSelectionMask({...base,mask:new Uint8Array(256)},{kind:'brush',points:[{x:3,y:3}],size:1,shape:'round',erase:false});
 const lasso=advancedSelectionMask(base,{kind:'lasso',points:[{x:10,y:10},{x:14,y:10},{x:14,y:14},{x:10,y:14}]});
 const combined=combineSelectionMasks(combineSelectionMasks(undefined,rect,'replace'),brush,'subtract'),out=combineSelectionMasks(combined,lasso,'union');
 const membership=(x,y)=>x<out.rect.x||y<out.rect.y||x>=out.rect.x+out.rect.width||y>=out.rect.y+out.rect.height?0:out.mask?.[(y-out.rect.y)*out.rect.width+x-out.rect.x]??1;
 assert.equal(membership(2,2),1);assert.equal(membership(3,3),0);assert.equal(membership(11,11),1);assert.equal(membership(9,9),0);
 const empty=combineSelectionMasks(out,out,'subtract');assert.ok(empty.mask.every(v=>!v));
 const other=captureSelection(createDocument(8,8),{x:0,y:0,width:8,height:8});assert.throws(()=>combineSelectionMasks(out,other,'union'),/different/);
});
