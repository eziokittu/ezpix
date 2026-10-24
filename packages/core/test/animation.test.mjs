import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,composite,encodeProject,decodeProject,frameAtTime,captureSelection,MAX_FRAMES,MAX_CEL_BYTES,convert,defaultRecipe} from '../dist/index.js';
test('frame duplication is independent across every layer; pixel undo targets its original cel',()=>{
  const e=new PixelEditor(createDocument(2,2));e.paint(0,0,[255,0,0,255]);e.commit();e.addLayer();e.paint(1,1,[0,0,255,128]);e.commit();e.addFrame(true);
  for(const l of e.document.layers){assert.notEqual(l.cels['frame-1'],l.cels['frame-2']);assert.deepEqual(l.cels['frame-1'],l.cels['frame-2']);}
  e.paint(1,1,[0,255,0,255]);e.commit();e.selectFrame('frame-1');assert.deepEqual([...e.document.cel.pixels.slice(12)],[0,0,255,128]);e.undo();assert.equal(e.document.activeFrameId,'frame-2');assert.deepEqual([...e.document.cel.pixels.slice(12)],[0,0,255,128]);e.redo();assert.deepEqual([...e.document.cel.pixels.slice(12)],[0,255,0,255]);
  e.addFrame();assert.ok(e.document.layers.every(l=>l.pixels.every(v=>v===0)));assert.ok(composite(e.document,'frame-1').some(v=>v));
});
test('frame deletion, order, duration and global layer edits round-trip through undo/redo',()=>{
  const e=new PixelEditor(createDocument(4,4));e.paint(0,0,[3,6,9,255]);e.commit();e.addFrame(true);e.setFrameDuration(250);e.moveFrame(-1);e.addLayer(true);e.renameLayer('Glow');const before=encodeProject(e.document);
  e.deleteFrame();e.undo();assert.equal(encodeProject(e.document),before);e.redo();e.undo();e.deleteLayer();e.undo();assert.equal(encodeProject(e.document),before);
  assert.deepEqual(decodeProject(before),e.document);assert.ok(e.historyBytes<=e.historyBudget);assert.throws(()=>e.setFrameDuration(19));assert.throws(()=>e.setFrameDuration(5001));assert.throws(()=>e.setFrameDuration(20.5));assert.throws(()=>new PixelEditor(createDocument()).deleteFrame());
});
test('dense cel allocation is bounded before adding frames/layers',()=>{
  const tiny=new PixelEditor(createDocument(1,1));while(tiny.document.frames.length<MAX_FRAMES)tiny.addFrame();assert.throws(()=>tiny.addFrame());
  const big=new PixelEditor(createDocument(256,256));while(big.document.frames.length<16)big.addFrame();const before=encodeProject(big.document);assert.throws(()=>big.addFrame(),/budget/);assert.throws(()=>big.addLayer(),/budget/);assert.equal(encodeProject(big.document),before);assert.equal(big.document.layers.reduce((n,l)=>n+Object.values(l.cels).reduce((m,p)=>m+p.byteLength,0),0),0);
});
test('v4 rejects hostile frame/cel schemas and migrates real layered v3 source/palette projects',()=>{
  const source={width:1,height:1,pixels:new Uint8ClampedArray([23,45,67,128])},e=new PixelEditor(convert(source,{...defaultRecipe(source),width:1,height:1}));e.addLayer(true);e.setPalette(['#abcdef']);
  const old=JSON.parse(encodeProject(e.document));old.version=3;old.layers=old.layers.map(l=>({id:l.id,name:l.name,visible:l.visible,rgba:l.cels[0].rgba}));delete old.frames;delete old.activeFrameId;
  const migrated=decodeProject(JSON.stringify(old));assert.deepEqual(migrated,e.document);assert.equal(JSON.parse(encodeProject(migrated)).version,16);
  e.addFrame(true);const good=JSON.parse(encodeProject(e.document)),layer=good.layers[0];
  for(const patch of [{frames:[]},{frames:Array(33).fill(good.frames[0])},{frames:[good.frames[0],good.frames[0]]},{frames:[{id:'frame-1',duration:0}]},{activeFrameId:'missing'},{layers:[{...layer,cels:[]}]},{layers:[{...layer,cels:[layer.cels[0],layer.cels[0]]}]},{width:256,height:256,layers:Array.from({length:16},(_,i)=>({...layer,id:`layer-${i+1}`}))}])assert.throws(()=>decodeProject(JSON.stringify({...good,...patch})));
});
test('playback duration boundaries loop from selection without mutating project state',()=>{
  const e=new PixelEditor(createDocument(1,1));e.setFrameDuration(20);e.addFrame();e.setFrameDuration(60);e.addFrame();e.setFrameDuration(100);e.selectFrame('frame-2');const before=encodeProject(e.document);
  for(const [time,id] of [[0,'frame-2'],[59,'frame-2'],[60,'frame-3'],[159,'frame-3'],[160,'frame-1'],[179,'frame-1'],[180,'frame-2'],[360,'frame-2']])assert.equal(frameAtTime(e.document,time),id);
  assert.equal(encodeProject(e.document),before);assert.throws(()=>frameAtTime(e.document,Infinity));assert.throws(()=>frameAtTime(e.document,-1));
});
test('selection and large bitmap history stay bound to the selected frame',()=>{
  const e=new PixelEditor(createDocument(64,64));const s=captureSelection(e.document,{x:0,y:0,width:1,height:1});e.addFrame(true);assert.throws(()=>e.applySelection(s,{x:1,y:0,copy:true,flipX:false,flipY:false}));
  e.shape('Rectangle',{x:0,y:0},{x:63,y:63},[12,34,56,255],true);e.commit();e.selectFrame('frame-1');e.undo();assert.equal(e.document.activeFrameId,'frame-2');assert.ok(e.document.cel.pixels.every(v=>v===0));e.redo();assert.equal(e.document.cel.pixels[3],255);assert.ok(e.document.layers[0].cels['frame-1'].every(v=>v===0));
});
