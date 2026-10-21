import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, PixelEditor, composite, encodeProject, decodeProject, MAX_LAYERS, convert, defaultRecipe } from '../dist/index.js';
test('selected-layer edits, source-over alpha, visibility and ordering use the same composite',()=>{
  const e=new PixelEditor(createDocument(1,1));e.paint(0,0,[255,0,0,255]);e.commit();e.addLayer();e.paint(0,0,[0,0,255,128]);e.commit();
  assert.deepEqual([...composite(e.document)],[127,0,128,255]);
  e.toggleLayer();e.paint(0,0,[0,255,0,255]);assert.equal(e.commit(),false);assert.deepEqual([...composite(e.document)],[255,0,0,255]);
  e.toggleLayer();e.moveLayer(-1);assert.deepEqual([...composite(e.document)],[255,0,0,255]);
  e.selectLayer('layer-1');e.paint(0,0,[0,0,0,0]);e.commit();assert.deepEqual([...composite(e.document)],[0,0,255,128]);
});
test('delete/duplicate/rename/reorder undo restores exact layers and pixels across selection changes',()=>{
  const e=new PixelEditor(createDocument(2,2));e.paint(0,0,[20,50,80,255]);e.commit();e.addLayer(true);e.renameLayer('Highlights');e.moveLayer(-1);
  const before=encodeProject(e.document);e.deleteLayer();assert.equal(e.document.layers.length,1);e.undo();assert.equal(encodeProject(e.document),before);
  e.undo();e.undo();e.undo();assert.equal(e.document.layers.length,1);e.undo();assert.ok(composite(e.document).every(v=>v===0));
  e.redo();e.redo();e.redo();e.redo();e.redo();assert.equal(e.document.layers.length,1);
  e.undo();e.paint(1,1,[9,8,7,255]);e.commit();assert.equal(e.canRedo,false);e.undo();assert.equal(encodeProject(e.document),before);
  assert.ok(e.historyBytes<=e.historyBudget);
});
test('layered projects and conversion survive round trip; v1/v2 migrate and hostile metadata is rejected',()=>{
  const e=new PixelEditor(createDocument(2,1));e.addLayer();e.renameLayer('Light');e.toggleLayer();
  const text=encodeProject(e.document);assert.deepEqual(decodeProject(text),e.document);
  for(const version of [1,2]){const old=decodeProject(JSON.stringify({format:'ezpix',version,width:1,height:1,name:'Old',pixels:[1,2,3,255]}));assert.deepEqual([...composite(old)],[1,2,3,255]);assert.equal(JSON.parse(encodeProject(old)).version,10);}
  const good=JSON.parse(text);
  for(const patch of [{layers:[]},{layers:Array(MAX_LAYERS+1).fill(good.layers[0])},{activeLayerId:'missing'},{layers:[good.layers[0],good.layers[0]]},{layers:[{...good.layers[0],visible:1}]},{layers:[{...good.layers[0],cels:[{frameId:'frame-1',rgba:'AA=='}]}]}])assert.throws(()=>decodeProject(JSON.stringify({...good,...patch})));
  while(e.document.layers.length<MAX_LAYERS)e.addLayer();assert.throws(()=>e.addLayer());
  const one=new PixelEditor(createDocument(1,1));assert.throws(()=>one.deleteLayer());assert.throws(()=>one.renameLayer('  '));
  const source={width:1,height:1,pixels:new Uint8ClampedArray([1,2,3,128])},converted=new PixelEditor(convert(source,{...defaultRecipe(source),width:1,height:1}));converted.addLayer(true);converted.paint(0,0,[90,80,70,255]);converted.commit();assert.deepEqual(decodeProject(encodeProject(converted.document)),converted.document);
});
