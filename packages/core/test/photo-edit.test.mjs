import test from 'node:test';import assert from 'node:assert/strict';
import {editPhoto,editPhotoFrames} from '../dist/photo-edit.js';
const source={width:3,height:2,pixels:new Uint8ClampedArray([1,0,0,255,2,0,0,255,3,0,0,255,4,0,0,255,5,0,0,255,6,0,0,255])};
test('quarter turns and normalized crops preserve exact source pixels',()=>{
 const rotated=editPhoto(source,{kind:'rotate',angle:90});assert.equal(rotated.width,2);assert.equal(rotated.height,3);assert.deepEqual([...rotated.pixels].filter((_,i)=>i%4===0),[4,1,5,2,6,3]);
 const crop=editPhoto(source,{kind:'crop',ratio:1,zoom:1,x:1,y:0});assert.equal(crop.width,2);assert.deepEqual([...crop.pixels].filter((_,i)=>i%4===0),[2,3,5,6]);assert.equal(source.pixels[0],1);
});
test('frames, text and deterministic effects preserve alpha and animation order',()=>{
 const image={width:16,height:16,pixels:new Uint8ClampedArray(16*16*4).fill(80)};
 const framed=editPhoto(image,{kind:'frame',size:.125,color:[10,20,30,255]});assert.equal(framed.width,20);assert.deepEqual([...framed.pixels.slice(0,4)],[10,20,30,255]);assert.deepEqual([...framed.pixels.slice((2*20+2)*4,(2*20+2)*4+4)],[80,80,80,80]);
 const text=editPhoto(image,{kind:'text',text:'A',size:4,x:0,y:0,color:[255,0,0,255]});assert.notDeepEqual(text.pixels,image.pixels);
 const edit={kind:'effect',effect:'grain',amount:.5};assert.deepEqual(editPhoto(image,edit),editPhoto(image,edit));
 const animation=editPhotoFrames([source,{...source,pixels:new Uint8ClampedArray(source.pixels).fill(9)}],{kind:'rotate',angle:180});assert.equal(animation[0].pixels[0],6);assert.equal(animation[1].pixels[0],9);assert.equal(source.pixels[0],1);
 for(const effect of ['vignette','posterize','duotone','grain']){const out=editPhoto(image,{kind:'effect',effect,amount:.7});for(let i=3;i<out.pixels.length;i+=4)assert.equal(out.pixels[i],80);}
});
test('invalid edits reject without modifying input or allocating oversized canvas',()=>{
 assert.throws(()=>editPhoto(source,{kind:'crop',ratio:NaN,zoom:1,x:0,y:0}));assert.throws(()=>editPhoto(source,{kind:'rotate',angle:45}));
 assert.throws(()=>editPhoto(source,{kind:'text',text:'😀',size:1,x:0,y:0,color:[0,0,0,255]}));
 const pixels=source.pixels.slice();assert.throws(()=>editPhotoFrames([source,{width:1,height:1,pixels:new Uint8ClampedArray(4)}],{kind:'rotate',angle:90}));assert.deepEqual(source.pixels,pixels);
});
