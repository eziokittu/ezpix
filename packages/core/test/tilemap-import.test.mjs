import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelEditor,createDocument,prepareAuthored,encodeProject,decodeProject,activeLayer,exportTilemapBundle,decodeTilemapBundle,composite} from '../dist/index.js';
import {writeNativeZip,readNativeZip} from '../dist/native-zip.js';
const op=(e,o)=>e.applyAuthored(prepareAuthored(e.document,{kind:'tilemap',...o},e.historyBudget));
async function fixture(){const e=new PixelEditor(createDocument(8,8));for(const [x,y,p] of [[0,0,[1,2,3,255]],[1,0,[4,5,6,128]],[0,1,[7,8,9,255]],[1,1,[10,11,12,0]]])e.paint(x,y,p);e.commit();op(e,{action:'create',tileWidth:2,tileHeight:2,name:'Tiles',populate:false});for(let flags=0;flags<8;flags++)op(e,{action:'paint',points:[{x:flags%4,y:Math.floor(flags/4)}],tile:0,flags});op(e,{action:'share',tilesetId:activeLayer(e.document).tilemap.tileset.id,name:'Shared'});op(e,{action:'paint',points:[{x:3,y:3}],tile:1,flags:5});e.setLayerOpacity(128);const files=await exportTilemapBundle(e.document);return {e,files};}
const text=new TextEncoder(),read=new TextDecoder();
function mapChange(files,mutate){const next=new Map(files),map=JSON.parse(read.decode(files.get('map.tmj')));mutate(map);next.set('map.tmj',text.encode(JSON.stringify(map)));return writeNativeZip(next);}

test('Tiled ZIP imports actual TMJ/PNG bytes, exact hidden RGB/unused tile IDs and shared aliases',async()=>{
 const {e,files}=await fixture();files.set('source.ezpix',text.encode('not trusted, not JSON'));const bytes=writeNativeZip(files);await assert.rejects(readNativeZip(bytes),/mimetype/);const doc=await decodeTilemapBundle(bytes),maps=e.document.layers.filter(l=>l.tilemap);assert.equal(doc.layers.length,2);assert.equal(doc.layers[0].tilemap.tileset,doc.layers[1].tilemap.tileset);assert.deepEqual(doc.layers[0].tilemap.tileset.tiles,maps[0].tilemap.tileset.tiles);assert.deepEqual(doc.layers[0].tilemap.cells,maps[0].tilemap.cells);assert.deepEqual(doc.layers[0].tilemap.flags,maps[0].tilemap.flags);assert.equal(doc.layers[1].opacity,128);const rounded=await decodeTilemapBundle(mapChange(files,m=>m.layers[0].opacity=.5));assert.equal(rounded.layers[0].opacity,128);assert.equal(encodeProject(decodeProject(encodeProject(doc))),encodeProject(doc));
 const originalOnly={...e.document,layers:maps};assert.deepEqual(composite(doc),composite(originalOnly));
});

test('reviewed map import appends detached tilesets above existing art in one stale-safe Undo',async()=>{
 const {e,files}=await fixture(),decoded=await decodeTilemapBundle(writeNativeZip(files));e.selectLayer(e.document.layers[0].id);e.paint(7,7,[91,92,93,255]);e.commit();const before=encodeProject(e.document),plan=prepareAuthored(e.document,{kind:'tilemap-import',project:encodeProject(decoded)});assert.equal(encodeProject(e.document),before);assert.ok(plan.changed);e.applyAuthored(plan);const maps=e.document.layers.filter(l=>l.tilemap);assert.equal(maps.length,4);assert.notEqual(maps[0].tilemap.tileset.id,maps[2].tilemap.tileset.id);assert.equal(maps[2].tilemap.tileset,maps[3].tilemap.tileset);assert.notEqual(maps[0].tilemap.tileset.tiles[0],maps[2].tilemap.tileset.tiles[0]);assert.deepEqual([...e.document.layers[0].cels[e.document.activeFrameId].slice(-4)],[91,92,93,255]);e.undo();assert.equal(encodeProject(e.document),before);e.redo();assert.throws(()=>e.applyAuthored(plan),/changed/);assert.throws(()=>prepareAuthored(createDocument(4,4),{kind:'tilemap-import',project:encodeProject(decoded)}),/matching-size/);
});

test('unsupported native contexts, remote/extra files, bad IDs/flags and corrupt ZIPs reject without interpretation',async()=>{
 const {files}=await fixture();for(const change of [m=>m.tilesets.push(m.tilesets[0]),m=>m.infinite=true,m=>m.layers[0].data[0]=0x10000001,m=>m.layers[0].data[0]=999,m=>m.layers[0].data[0]=0x80000000,m=>m.layers[0].data.pop(),m=>m.layers[0].opacity=2,m=>m.layers[0].offsetx=1,m=>m.tilesets[0].image='https://bad.invalid/a.png',m=>m.tilesets[0].tilecount=257,m=>m.properties=[{name:'untrusted',value:'x'}],m=>m.layers[1].id=m.layers[0].id,m=>m.version='1.11'])await assert.rejects(decodeTilemapBundle(mapChange(files,change)));
 const extra=new Map(files);extra.set('script.js',text.encode('no'));await assert.rejects(decodeTilemapBundle(writeNativeZip(extra)),/Unexpected/);const broken=writeNativeZip(files);broken[40]^=1;await assert.rejects(decodeTilemapBundle(broken));
});

test('import respects aggregate tile/map/history budgets and locks without mutation',async()=>{
 const {e,files}=await fixture(),project=encodeProject(await decodeTilemapBundle(writeNativeZip(files))),before=encodeProject(e.document);assert.throws(()=>prepareAuthored(e.document,{kind:'tilemap-import',project},1),/budget/);assert.equal(encodeProject(e.document),before);e.toggleLayerLock();const locked=encodeProject(e.document);assert.throws(()=>prepareAuthored(e.document,{kind:'tilemap-import',project}),/unlock/);assert.equal(encodeProject(e.document),locked);
});
