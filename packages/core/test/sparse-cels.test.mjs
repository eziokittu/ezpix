import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,encodeProject,decodeProject,composite,rasterCel,celAllocation,MAX_CEL_BYTES,encodeAseprite,decodeAseprite,encodePiskel,decodePiskel,encodePsd,decodePsd,encodeOra,decodeOra,exportSheet} from '../dist/index.js';
test('empty slots retain zero RGBA bytes, reads stay sparse and conservative limits remain',()=>{
 const e=new PixelEditor(createDocument(256,256)),d=e.document;while(d.frames.length<16)e.addFrame();assert.deepEqual(celAllocation(d),{bytes:0,denseBytes:MAX_CEL_BYTES,empty:16});
 for(const f of d.frames){assert.equal(composite(d,f.id).length,256*256*4);assert.ok(rasterCel(d,d.layers[0],f.id).every(v=>v===0));}assert.equal(celAllocation(d).bytes,0);assert.throws(()=>e.addFrame(),/budget/);
 e.paint(0,0,[9,8,7,0]);e.commit();assert.equal(celAllocation(d).bytes,256*256*4);assert.equal(celAllocation(d).empty,15);e.undo();assert.equal(celAllocation(d).bytes,0);e.redo();assert.deepEqual([...rasterCel(d,d.layers[0]).slice(0,4)],[9,8,7,0]);
});
test('clear cel, no-op erase, duplication, tags/groups and structural redo preserve empty state',()=>{
 const e=new PixelEditor(createDocument(2,2)),d=e.document;e.paint(0,0,[0,0,0,0]);assert.equal(e.commit(),false);assert.equal(celAllocation(d).bytes,0);e.paint(0,0,[1,2,3,255]);e.commit();e.addFrame(true);e.setTag({name:'Two',from:0,to:1,mode:'reverse'});e.createGroup();const before=encodeProject(d);
 e.clearCel();assert.equal(celAllocation(d).empty,1);assert.ok(composite(d).every(v=>!v));e.undo();assert.equal(encodeProject(d),before);e.redo();assert.equal(celAllocation(d).empty,1);e.undo();e.addFrame();e.addLayer();assert.equal(celAllocation(d).empty,4);e.undo();e.undo();assert.equal(encodeProject(d),before);
 e.toggleLayerLock();assert.throws(()=>e.clearCel(),/unlock/);
});
test('v8 empty metadata is unambiguous and old zero buffers compact without losing transparent RGB',()=>{
 const d=createDocument(2,1),data=JSON.parse(encodeProject(d));assert.equal(data.version,13);assert.deepEqual(data.layers[0].cels,[{frameId:'frame-1',empty:true}]);
 for(const cel of [{frameId:'frame-1',empty:false},{frameId:'frame-1',empty:true,rgba:'AAAAAAAAAAA='},{frameId:'frame-1',empty:true,link:'frame-1'},{frameId:'frame-1'},{frameId:'missing',empty:true}]){const bad=structuredClone(data);bad.layers[0].cels=[cel];assert.throws(()=>decodeProject(JSON.stringify(bad)));}
 for(const version of [4,5,6,7]){const old=structuredClone(data);old.version=version;old.layers[0].cels=[{frameId:'frame-1',rgba:'AAAAAAAAAAA='}];const imported=decodeProject(JSON.stringify(old));assert.equal(celAllocation(imported).bytes,0);old.layers[0].cels[0].rgba=Buffer.from([7,8,9,0,0,0,0,0]).toString('base64');const hidden=decodeProject(JSON.stringify(old));assert.equal(celAllocation(hidden).bytes,8);assert.deepEqual([...rasterCel(hidden,hidden.layers[0])],[7,8,9,0,0,0,0,0]);}
 assert.equal(encodeProject(decodeProject(JSON.stringify(data))),JSON.stringify(data));
});
test('empty cel adapters export valid native projects and sheets without mutating source',async()=>{
 const e=new PixelEditor(createDocument(3,2));e.addFrame();e.paint(1,1,[10,20,30,255]);e.commit();e.addFrame();const d=e.document,before=encodeProject(d);
 const ase=(await decodeAseprite(encodeAseprite(d))).document,piskel=(await decodePiskel((await encodePiskel(d,10)).text)).document;
 for(const imported of [ase,piskel])for(let i=0;i<3;i++)assert.deepEqual(composite(imported,imported.frames[i].id),composite(d,d.frames[i].id));
 e.selectFrame('frame-1');const original=encodeProject(d);for(const imported of [decodePsd(encodePsd(d,'selected-frame').bytes).document,(await decodeOra((await encodeOra(d,'selected-frame')).bytes)).document])assert.ok(composite(imported).every(v=>!v));assert.equal(encodeProject(d),original);assert.equal(exportSheet(d,{columns:3,scale:1,padding:0,spacing:0}).raster.pixels.filter(v=>v!==0).length,4);e.selectFrame('frame-3');assert.equal(encodeProject(d),before);
});
