import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paintPhoto,GRADIENT_STYLES} from '../dist/photo-paint.js';
import {PhotoWorkspace} from '../dist/photo-workspace.js';
import {encodePhotoProject,decodePhotoProject} from '../dist/photo-project.js';
const raster=(w,h,colors)=>({width:w,height:h,pixels:Uint8ClampedArray.from(Array.from({length:w*h},(_,i)=>colors[i%colors.length]).flat())});
const options={mode:'gradient',foreground:[255,0,0,255],background:[0,0,255,255],opacity:1,start:{x:0,y:0},end:{x:1,y:0},style:'linear',tolerance:0,contiguous:true,pattern:'checker',scale:2};
test('photo gradients preserve endpoints, source and exact selection membership',()=>{
 const source=raster(3,2,[[255,255,255,255]]),original=source.pixels.slice();
 const edit=paintPhoto(source,options,new Uint8Array([1,1,1,0,0,0]));
 assert.deepEqual([...edit.image.pixels.slice(0,12)],[255,0,0,255,128,0,128,255,0,0,255,255]);
 assert.deepEqual(edit.image.pixels.slice(12),original.slice(12));assert.deepEqual(source.pixels,original);
 for(const style of GRADIENT_STYLES)assert.equal(paintPhoto(source,{...options,style}).image.pixels.length,24);
});
test('bucket connectivity, tolerance, transparent boundaries and selection barriers',()=>{
 const source=raster(5,1,[[10,10,10,255],[12,12,12,255],[250,250,250,255],[10,10,10,255],[10,10,10,0]]);
 const fill={...options,mode:'bucket',tolerance:2};
 assert.deepEqual([...paintPhoto(source,fill).mask],[1,1,0,0,0]);
 assert.deepEqual([...paintPhoto(source,{...fill,contiguous:false}).mask],[1,1,0,1,0]);
 assert.deepEqual([...paintPhoto(source,fill,new Uint8Array([1,0,1,1,1])).mask],[1,0,0,0,0]);
 assert.deepEqual([...paintPhoto(source,fill,new Uint8Array(5)).mask],[0,0,0,0,0]);
});
test('paint alpha, pattern and bounded full-resolution operation',()=>{
 const source=raster(1024,1024,[[0,0,0,255]]);
 const result=paintPhoto(source,{...options,mode:'solid',opacity:.5});assert.deepEqual([...result.image.pixels.slice(0,4)],[128,0,0,255]);
 const pattern=paintPhoto(raster(4,1,[[0,0,0,0]]),{...options,mode:'pattern'});
 assert.deepEqual([...pattern.image.pixels],[255,0,0,255,255,0,0,255,0,0,255,255,0,0,255,255]);
 assert.throws(()=>paintPhoto(source,{...options,opacity:NaN}));assert.throws(()=>paintPhoto(source,options,new Uint8Array(1)));
 assert.throws(()=>paintPhoto(source,{...options,end:options.start}));
});
test('paint uses existing patch schema, survives reopen and retains undo and Original',()=>{
 const source=raster(4,4,[[255,255,255,255]]),workspace=new PhotoWorkspace([source],true),edit=paintPhoto(source,options);
 workspace.append(edit,'Paint');const expected=workspace.renderFirst().pixels;
 const saved=decodePhotoProject(encodePhotoProject(workspace.snapshot())),reopened=new PhotoWorkspace(saved.original);reopened.restore(saved);
 assert.deepEqual(reopened.renderFirst().pixels,expected);assert.deepEqual(reopened.original().pixels,source.pixels);
 assert.equal(workspace.undoEdit(),true);assert.deepEqual(workspace.renderFirst().pixels,source.pixels);assert.equal(workspace.redoEdit(),true);assert.deepEqual(workspace.renderFirst().pixels,expected);
});
