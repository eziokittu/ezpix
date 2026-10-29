import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,prepareAuthored,encodeProject,decodeProject,composite,rasterCel,activeLayer,prepareCanvasGeometry,encodeAseprite,prepareDrawing,defaultDrawingOptions,exportTilemapBundle,prepareLayerWorkflow} from '../dist/index.js';
import {decodeNativePngData} from '../dist/native-png.js';
const execute=(e,o)=>e.applyAuthored(prepareAuthored(e.document,{kind:'tilemap',...o},e.historyBudget));
function fixture(){const e=new PixelEditor(createDocument(4,4));e.paint(0,0,[255,0,0,255]);e.paint(1,0,[0,255,0,255]);e.paint(0,1,[0,0,255,255]);e.paint(1,1,[1,2,3,0]);e.commit();execute(e,{action:'create',tileWidth:2,tileHeight:2,name:'Map',populate:false});return e;}
test('tilemaps persist as integrated v17 layers while ordinary projects retain v16',()=>{
 assert.equal(JSON.parse(encodeProject(createDocument())).version,16);const e=fixture(),d=e.document;assert.equal(JSON.parse(encodeProject(d)).version,17);assert.equal(d.layers.length,2);assert.equal(activeLayer(d).cels[d.activeFrameId].length,0);
 execute(e,{action:'paint',points:[{x:1,y:1}],tile:0,flags:0});const opened=decodeProject(encodeProject(d));assert.equal(encodeProject(opened),encodeProject(d));assert.deepEqual([...rasterCel(opened,activeLayer(opened)).slice((2*4+2)*4,(2*4+2)*4+4)],[255,0,0,255]);assert.deepEqual([...activeLayer(opened).tilemap.tileset.tiles[0].slice(12)],[1,2,3,0]);
});
test('all eight tile transforms use exact shared identity and preserve hidden RGB',()=>{
 const e=fixture();const expected=[0,1,2,3,4,5,6,7].map(flags=>{execute(e,{action:'paint',points:[{x:0,y:0}],tile:0,flags});return [...rasterCel(e.document,activeLayer(e.document)).slice(0,8)];});
 assert.deepEqual(expected[0],[255,0,0,255,0,255,0,255]);assert.deepEqual(expected[1],[0,255,0,255,255,0,0,255]);assert.deepEqual(expected[5],[0,0,255,255,255,0,0,255]);assert.deepEqual(expected[6],[0,255,0,255,1,2,3,0]);assert.equal(new Set(expected.map(p=>p.join())).size,8);
});
test('shared tile pixel edits update every map in one atomic Undo with private stale-safe plans',()=>{
 const e=fixture(),set=activeLayer(e.document).tilemap.tileset;execute(e,{action:'paint',points:[{x:0,y:0}],tile:0,flags:0});execute(e,{action:'share',tilesetId:set.id,name:'Second map'});execute(e,{action:'paint',points:[{x:1,y:1}],tile:0,flags:0});const before=encodeProject(e.document),plan=prepareAuthored(e.document,{kind:'tilemap',action:'tile-pixel',tile:0,x:0,y:0,color:[9,8,7,111]});assert.equal(encodeProject(e.document),before);e.applyAuthored(plan);const maps=e.document.layers.filter(l=>l.tilemap);assert.equal(maps[0].tilemap.tileset,maps[1].tilemap.tileset);assert.deepEqual([...maps[0].tilemap.tileset.tiles[0].slice(0,4)],[9,8,7,111]);assert.deepEqual([...set.tiles[0].slice(0,4)],[255,0,0,255]);e.undo();assert.equal(encodeProject(e.document),before);e.redo();assert.throws(()=>e.applyAuthored(plan),/changed/);
 const reopened=decodeProject(encodeProject(e.document));const loaded=reopened.layers.filter(l=>l.tilemap);assert.equal(loaded[0].tilemap.tileset,loaded[1].tilemap.tileset);
});
test('tile identity reorder/removal remaps every shared reference and restores exactly',()=>{
 const e=fixture();execute(e,{action:'paint',points:[{x:0,y:0}],tile:0,flags:5});execute(e,{action:'paint',points:[{x:1,y:0}],tile:2,flags:0});const before=encodeProject(e.document);execute(e,{action:'remap',order:[2,0,1],replacement:-1});assert.deepEqual([...activeLayer(e.document).tilemap.cells],[1,0,-1,-1]);assert.equal(activeLayer(e.document).tilemap.flags[0],5);e.undo();assert.equal(encodeProject(e.document),before);
 execute(e,{action:'remap',order:[2,1],replacement:-1});assert.deepEqual([...activeLayer(e.document).tilemap.cells],[-1,0,-1,-1]);assert.equal(activeLayer(e.document).tilemap.flags[0],0);
});
test('map layers follow normal layer structure and static frame rendering, then bake with explicit rasterization',()=>{
 const e=fixture();execute(e,{action:'paint',points:[{x:0,y:0}],tile:0,flags:0});e.addLayer(true);assert.ok(activeLayer(e.document).tilemap);e.addFrame(true);const doc=e.document,before=composite(doc);assert.deepEqual(composite(doc,doc.frames[0].id),before);
 const text=encodeProject(doc);execute(e,{action:'rasterize'});assert.equal(activeLayer(doc).tilemap,undefined);assert.deepEqual(composite(doc),before);e.undo();assert.equal(encodeProject(doc),text);assert.ok(e.historyBytes>0);
});
test('existing raw/geometry/native/indexed operations fail closed on live tilemaps',()=>{
 const e=fixture(),d=e.document,before=encodeProject(d);assert.throws(()=>prepareDrawing(d,[{x:0,y:0}],defaultDrawingOptions()),/unlock|raster|editable/i);assert.throws(()=>prepareCanvasGeometry(d,{kind:'scale',width:8,height:8}),/Rasterize/);assert.throws(()=>encodeAseprite(d),/baking|flattened/);assert.throws(()=>e.applyAuthored(prepareAuthored(d,{kind:'indexed-document',action:'enter'})),/plain/);assert.equal(encodeProject(d),before);
});
test('locks, missing identities, bad flags, over-budget and malformed v17 files preserve current art',()=>{
 const e=fixture(),d=e.document;execute(e,{action:'share',tilesetId:activeLayer(d).tilemap.tileset.id,name:'Other'});e.selectLayer(d.layers[1].id);e.toggleLayerLock();e.selectLayer(d.layers[2].id);const before=encodeProject(d);assert.throws(()=>execute(e,{action:'tile-pixel',tile:0,x:0,y:0,color:[1,2,3,255]}),/Unlock/);assert.equal(encodeProject(d),before);
 for(const mutate of [p=>p.layers[1].tilemap.flags[0]=9,p=>p.layers[1].tilemap.cells[0]=999,p=>p.tilesets[0].tiles[0]='bad',p=>p.layers[1].tilemap.tilesetId='missing',p=>p.version=16,p=>p.layers[1].tilemap.cells.push(0)]){const data=JSON.parse(before);mutate(data);assert.throws(()=>decodeProject(JSON.stringify(data)));}
 const planInput={kind:'tilemap',action:'paint',points:[{x:0,y:0}],tile:0,flags:0};assert.throws(()=>prepareAuthored(d,planInput,1),/budget/);assert.equal(encodeProject(d),before);
});

test('live map masks/effects use normal layer rendering and budgeted Undo; raw transfer cannot lose tile identities',()=>{
 const e=fixture();execute(e,{action:'paint',points:[{x:0,y:0}],tile:0,flags:0});const before=encodeProject(e.document),id=e.document.activeLayerId;
 e.applyLayerWorkflow(prepareLayerWorkflow(e.document,{kind:'mask',layerId:id,source:'black'}));assert.ok(activeLayer(e.document).tilemap);assert.ok(activeLayer(e.document).mask);e.undo();assert.equal(encodeProject(e.document),before);
 assert.throws(()=>prepareLayerWorkflow(e.document,{kind:'bake-effects',layerId:id}),/Rasterize/);
 const other=createDocument(4,4);assert.throws(()=>prepareAuthored(other,{kind:'document-transfer',project:before,destination:'layer'}),/Rasterize a tilemap/);
 const reference=prepareAuthored(other,{kind:'document-transfer',project:before,destination:'reference'});assert.ok(reference.changed);
});

test('Tiled bundle preserves exact slots, shared global IDs and all unsigned flip bits without mutating artwork',async()=>{
 const e=fixture();execute(e,{action:'share',tilesetId:activeLayer(e.document).tilemap.tileset.id,name:'Shared'});execute(e,{action:'paint',points:[{x:1,y:1}],tile:3,flags:7});const before=encodeProject(e.document);
 const files=await exportTilemapBundle(e.document),map=JSON.parse(new TextDecoder().decode(files.get('map.tmj')));assert.equal(map.tilesets.length,1);assert.equal(map.layers.length,2);assert.equal(map.layers[1].data[3],0xe0000004);assert.equal(map.layers[1].data[0],0);assert.equal(map.tilesets[0].tilecount,4);
 const set=map.tilesets[0],{pixels:raw}=await decodeNativePngData(files.get(set.image),set.imagewidth,set.imageheight);assert.deepEqual([...raw.slice((1*set.imagewidth+1)*4,(1*set.imagewidth+1)*4+4)],[1,2,3,0]);
 assert.equal(new TextDecoder().decode(files.get('source.ezpix')),before);assert.equal(encodeProject(e.document),before);
 const l=activeLayer(e.document);l.blendMode='multiply';await assert.rejects(exportTilemapBundle(e.document),/non-Normal/);l.blendMode='normal';l.effects=[{kind:'invert',enabled:true,amount:0}];await assert.rejects(exportTilemapBundle(e.document),/effects/);
});

test('ordinary structural commands enforce aggregate map budgets and roll back without losing Redo',()=>{
 const doc=createDocument(256,256);doc.layers[0].tilemap={tileset:{id:'tileset-1',name:'One tile',width:1,height:1,tiles:[new Uint8ClampedArray([1,2,3,255])]},cells:new Int16Array(65536).fill(-1),flags:new Uint8Array(65536)};const e=new PixelEditor(decodeProject(encodeProject(doc)));e.setLayerOpacity(128);e.undo();const before=encodeProject(e.document),bytes=e.historyBytes;
 for(const duplicate of [()=>e.addLayer(true),()=>e.duplicateLayers([e.document.activeLayerId])]){assert.throws(duplicate,/65536/);assert.equal(encodeProject(e.document),before);assert.equal(e.canRedo,true);assert.equal(e.historyBytes,bytes);}
 e.redo();assert.equal(activeLayer(e.document).opacity,128);
});
