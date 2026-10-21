import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,brushOffsets,encodeProject,decodeProject} from '../dist/index.js';
const green=[33,177,88,255],occupied=doc=>{const points=[];for(let y=0;y<doc.height;y++)for(let x=0;x<doc.width;x++)if(doc.cel.pixels[(y*doc.width+x)*4+3])points.push(`${x},${y}`);return points;};
test('brush goldens, bounds and immutable cached footprints',()=>{
  assert.deepEqual(brushOffsets({size:1,shape:'circle'}),[{x:0,y:0}]);
  assert.deepEqual(brushOffsets({size:3,shape:'circle'}).map(p=>`${p.x},${p.y}`),['0,-1','-1,0','0,0','1,0','0,1']);
  assert.equal(brushOffsets({size:4,shape:'circle'}).length,12);
  assert.equal(brushOffsets({size:32,shape:'square'}).length,1024);
  assert.throws(()=>{brushOffsets({size:2,shape:'square'})[0].x=999;});
  for(const brush of [{size:0,shape:'square'},{size:33,shape:'square'},{size:1.5,shape:'circle'},{size:NaN,shape:'square'},{size:4,shape:'noise'}])assert.throws(()=>brushOffsets(brush));
});
test('sized strokes interpolate, clip, mirror exact painted pixels and undo once',()=>{
  const doc=createDocument(8,8),editor=new PixelEditor(doc);
  editor.line(0,0,0,0,green,true,true,{size:3,shape:'square'});editor.commit();
  assert.deepEqual(occupied(doc),['0,0','1,0','6,0','7,0','0,1','1,1','6,1','7,1','0,6','1,6','6,6','7,6','0,7','1,7','6,7','7,7']);
  editor.undo();assert.deepEqual(occupied(doc),[]);assert.equal(editor.canUndo,false);editor.redo();
  assert.deepEqual([...decodeProject(encodeProject(doc)).cel.pixels],[...doc.cel.pixels]);
  const line=new PixelEditor(createDocument(12,5));line.line(1,2,10,2,green,false,false,{size:3,shape:'circle'});line.commit();
  for(let x=1;x<=10;x++)for(const y of [1,2,3])assert.equal(line.document.cel.pixels[(y*12+x)*4+3],255);
  line.line(1,2,10,2,[0,0,0,0],false,false,{size:3,shape:'circle'});line.commit();assert.equal(occupied(line.document).length,0);line.undo();assert.ok(occupied(line.document).length>0);
});
test('size one remains identical; bad coordinates fail before changing pixels; strokes stay on their frame/layer',()=>{
  const a=new PixelEditor(createDocument(10,10)),b=new PixelEditor(createDocument(10,10));a.line(1,8,8,1,green,true,false);b.line(1,8,8,1,green,true,false,{size:1,shape:'circle'});assert.deepEqual(a.document.cel.pixels,b.document.cel.pixels);
  for(const bad of [NaN,Infinity,0.5,-1,10])assert.throws(()=>a.line(bad,0,1,1,green));
  const editor=new PixelEditor(createDocument(8,8));editor.addLayer();const layer=editor.document.activeLayerId;editor.addFrame();const frame=editor.document.activeFrameId;
  editor.line(3,3,3,3,green,false,false,{size:4,shape:'circle'});editor.commit();editor.selectFrame('frame-1');assert.equal(occupied(editor.document).length,0);editor.undo();assert.equal(editor.document.activeFrameId,frame);assert.equal(editor.document.activeLayerId,layer);assert.equal(occupied(editor.document).length,0);editor.redo();assert.equal(occupied(editor.document).length,12);
});
