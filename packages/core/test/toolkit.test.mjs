import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,PixelEditor,shapePoints,captureSelection,transformSelection,decodePalette,encodePalette,grabPalette,encodeProject,decodeProject,MAX_PALETTE_BYTES} from '../dist/index.js';
test('full-size shape and selection retain atomic undo within the default history budget',()=>{
  const e=new PixelEditor(createDocument(256,256));e.shape('Rectangle',{x:0,y:0},{x:255,y:255},[10,20,30,255],true);e.commit();assert.equal(e.canUndo,true);assert.ok(e.historyBytes<1024*1024);e.undo();assert.ok(e.document.cel.pixels.every(v=>v===0));e.redo();assert.equal(e.document.cel.pixels[262143],255);
  const s=captureSelection(e.document,{x:0,y:0,width:256,height:128});e.applySelection(s,{x:0,y:128,copy:false,flipX:true,flipY:true});assert.equal(e.document.cel.pixels[3],0);e.undo();assert.equal(e.document.cel.pixels[3],255);assert.ok(e.historyBytes<=e.historyBudget);
});
test('integer shapes have golden bounds, reversal symmetry and atomic layer-bound undo',()=>{
  const a={x:1,y:1},b={x:4,y:4};
  assert.deepEqual(shapePoints('Line',a,b),[{x:1,y:1},{x:2,y:2},{x:3,y:3},{x:4,y:4}]);
  assert.equal(shapePoints('Rectangle',a,b).length,12);assert.equal(shapePoints('Rectangle',b,a,true).length,16);
  assert.equal(shapePoints('Ellipse',a,b).length,8);assert.equal(shapePoints('Ellipse',a,b,true).length,12);
  for(const kind of ['Rectangle','Ellipse']){assert.deepEqual(shapePoints(kind,a,b),shapePoints(kind,b,a));assert.deepEqual(shapePoints(kind,a,a),[a]);}
  assert.throws(()=>shapePoints('Line',a,{x:Infinity,y:2}));assert.throws(()=>shapePoints('Ellipse',a,{x:1.5,y:2}));
  const e=new PixelEditor(createDocument(8,8));e.addLayer();e.shape('Rectangle',a,b,[12,34,56,128],true);e.commit();assert.ok(e.document.layers[0].pixels.every(v=>v===0));const result=e.document.cel.pixels.slice();e.undo();assert.ok(e.document.cel.pixels.every(v=>v===0));e.redo();assert.deepEqual(e.document.cel.pixels,result);
});
test('overlapping moves/copies/flips preserve RGBA holes, cancel is pure and apply is one undo',()=>{
  const e=new PixelEditor(createDocument(4,2));e.paint(0,0,[255,0,0,128]);e.paint(1,0,[0,0,0,0]);e.paint(2,0,[0,255,0,255]);e.commit();
  const before=e.document.cel.pixels.slice(),s=captureSelection(e.document,{x:0,y:0,width:2,height:1}),options={x:1,y:0,copy:false,flipX:false,flipY:false};
  const preview=transformSelection(s,options);assert.deepEqual(e.document.cel.pixels,before,'preview/cancel never edits doc');assert.deepEqual([...preview.slice(0,12)],[0,0,0,0,255,0,0,128,0,0,0,0]);
  e.applySelection(s,options);assert.deepEqual(e.document.cel.pixels,preview);e.undo();assert.deepEqual(e.document.cel.pixels,before);e.redo();assert.deepEqual(e.document.cel.pixels,preview);
  e.undo();const copied=transformSelection(s,{...options,copy:true,flipX:true});assert.deepEqual([...copied.slice(0,12)],[255,0,0,128,0,0,0,0,255,0,0,128]);
  const vertical=captureSelection(e.document,{x:0,y:0,width:1,height:2});const flipped=transformSelection(vertical,{x:0,y:0,copy:false,flipX:false,flipY:true});assert.deepEqual([...flipped.slice(16,20)],[255,0,0,128]);
  assert.throws(()=>transformSelection(s,{...options,x:3}));assert.throws(()=>transformSelection(s,{...options,x:-1}));
});
test('selection binding rejects other/hidden/stale layers and pending state never enters files',()=>{
  const e=new PixelEditor(createDocument(2,2));e.paint(0,0,[1,2,3,255]);e.commit();const original=encodeProject(e.document),s=captureSelection(e.document,{x:0,y:0,width:1,height:1}),o={x:1,y:1,copy:true,flipX:false,flipY:false};
  e.addLayer();assert.throws(()=>e.applySelection(s,o));e.selectLayer(s.layerId);e.toggleLayer();assert.throws(()=>e.applySelection(s,o));assert.throws(()=>captureSelection(e.document,s.rect));e.toggleLayer();e.paint(1,0,[9,8,7,255]);e.commit();assert.throws(()=>e.applySelection(s,o));
  assert.equal(JSON.parse(original).selection,undefined);assert.equal(decodeProject(original).palette.length,12);
});
test('palette files are bounded and normalized; edits/history/project persistence never recolour pixels',()=>{
  const e=new PixelEditor(createDocument(2,1));e.paint(0,0,[22,44,66,255]);e.commit();const pixels=e.document.cel.pixels.slice(),before=e.document.palette.slice();
  const colors=decodePalette(encodePalette(['#ABCDEF','#abcdef','#010203']));assert.deepEqual(colors,['#abcdef','#010203']);e.setPalette(colors);assert.deepEqual(e.document.cel.pixels,pixels);assert.deepEqual(decodeProject(encodeProject(e.document)).palette,colors);e.undo();assert.deepEqual(e.document.palette,before);e.redo();assert.deepEqual(e.document.palette,colors);
  assert.deepEqual(grabPalette(e.document),['#162c42']);
  for(const text of ['null','{}','{','x'.repeat(MAX_PALETTE_BYTES+1),JSON.stringify({format:'ezpix-palette',version:1,colors:[]}),JSON.stringify({format:'ezpix-palette',version:1,colors:['red']}),JSON.stringify({format:'ezpix-palette',version:1,colors:Array(257).fill('#ffffff')})])assert.throws(()=>decodePalette(text));
  const legacy=JSON.parse(encodeProject(e.document));delete legacy.palette;assert.equal(decodeProject(JSON.stringify(legacy)).palette.length,12);
});
