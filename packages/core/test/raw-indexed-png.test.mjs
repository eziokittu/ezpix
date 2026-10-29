import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRawIndexedPng,decodeRawIndexedPng,largeFromIndexedPng,captureLargeIndexedPng,encodeLargeProject,decodeLargeProject,LargeCanvasEditor,createLargeIndexed} from '../dist/index.js';
import {pngChunk} from '../dist/native-png.js';
import {concat} from '../dist/native-utils.js';
const fixture=()=>({width:257,height:3,palette:[[11,22,33,0],[80,90,100,255],[80,90,100,255],[44,55,66,0],[1,2,3,127]],indices:Uint8Array.from({length:257*3},(_,i)=>i%5)});
test('raw indexed PNG retains ordered duplicate/unused slots, several transparent slots, partial alpha and direct indices',async()=>{
 const source=fixture();source.palette.push([99,88,77,255]);const bytes=await encodeRawIndexedPng(source),decoded=await decodeRawIndexedPng(bytes);assert.deepEqual(decoded,source);
 const restored=largeFromIndexedPng(decoded,3);assert.equal(restored.indexed.transparentIndex,3);assert.deepEqual(captureLargeIndexedPng(restored,{x:0,y:0,width:257,height:3}),source);
 assert.deepEqual(captureLargeIndexedPng(decodeLargeProject(encodeLargeProject(restored)),{x:0,y:0,width:257,height:3}),source);
});
test('raw PNG clear role is explicit, may append without remapping, and rejects an opaque full table',()=>{
 const raw=fixture();assert.throws(()=>largeFromIndexedPng(raw,1),/zero-alpha/);assert.throws(()=>largeFromIndexedPng(raw,undefined),/Choose/);
 const appended=largeFromIndexedPng(raw,'append');assert.equal(appended.indexed.transparentIndex,raw.palette.length);assert.deepEqual(captureLargeIndexedPng(appended,{x:0,y:0,width:257,height:3}).indices,raw.indices);assert.deepEqual(appended.indexed.palette.slice(0,-1),raw.palette);
 const full={width:1,height:1,palette:Array.from({length:256},(_,i)=>[i,i,i,255]),indices:Uint8Array.of(244)};assert.throws(()=>largeFromIndexedPng(full,'append'),/256/);
});
test('raw export ignores membership, coverage and layer display metadata without changing raw artwork',()=>{
 const d=largeFromIndexedPng(fixture(),0),editor=new LargeCanvasEditor(d);editor.selection.set({rect:{x:0,y:0,width:3,height:3},bits:new Uint8Array(9)});
 d.layers[0].visible=false;d.layers[0].opacity=7;const before=encodeLargeProject(d);assert.deepEqual(captureLargeIndexedPng(d,{x:0,y:0,width:257,height:3}),fixture());assert.equal(encodeLargeProject(d),before);
});
test('raw PNG rejects corruption, profiles, packed/RGBA storage, trailing bytes and out-of-bounds slot planes',async()=>{
 const bytes=await encodeRawIndexedPng(fixture()),bad=bytes.slice();bad[45]^=1;await assert.rejects(()=>decodeRawIndexedPng(bad),/checksum/);
 await assert.rejects(()=>decodeRawIndexedPng(concat([bytes,Uint8Array.of(0)])),/ending/);
 await assert.rejects(()=>decodeRawIndexedPng(concat([bytes.subarray(0,33),pngChunk('gAMA',new Uint8Array(4)),bytes.subarray(33)])),/profiles/);
 const rgba=bytes.slice();rgba[25]=6;await assert.rejects(()=>decodeRawIndexedPng(rgba),/palette storage/);
 await assert.rejects(()=>encodeRawIndexedPng({...fixture(),indices:Uint8Array.of(255)}),/slot plane/);
});
test('raw PNG snapshots input before asynchronous encoding and enforces one-megapixel windows',async()=>{
 const source=fixture(),expected=structuredClone(source),pending=encodeRawIndexedPng(source);source.indices.fill(0);source.palette[1][0]=0;assert.deepEqual(await decodeRawIndexedPng(await pending),expected);
 const atLimit={width:1024,height:1024,palette:[[0,0,0,0],[9,8,7,255]],indices:Uint8Array.from({length:1048576},(_,i)=>i&1)};
 assert.deepEqual((await decodeRawIndexedPng(await encodeRawIndexedPng(atLimit))).indices,atLimit.indices);
 await assert.rejects(()=>encodeRawIndexedPng({...atLimit,height:1025,indices:new Uint8Array(1024*1025)}),/one megapixel/);
 assert.throws(()=>captureLargeIndexedPng(createLargeIndexed(10240,10240,[[0,0,0,0]],0),{x:0,y:0,width:1025,height:1024}),/one megapixel/);
});
