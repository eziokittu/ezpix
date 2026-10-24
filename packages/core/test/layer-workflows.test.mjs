import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BLEND_MODES,PixelEditor,createDocument,encodeProject,decodeProject,composite,encodeAseprite,encodePiskel,encodePsd,decodePsd,encodeOra,decodeOra,defaultStudioOptions,prepareStudio,prepareCanvasGeometry,captureClip,decodeClip} from '../dist/index.js';
const fixture=()=>{const e=new PixelEditor(createDocument(2,1,'Layer study'));e.paint(0,0,[64,128,192,255]);e.paint(1,0,[19,37,91,0]);e.commit();e.addLayer();e.paint(0,0,[192,64,128,255]);e.paint(1,0,[200,100,50,128]);e.commit();e.addFrame();e.linkCel('frame-1');e.selectFrame('frame-1');return e;};
const atomic=(e,operation)=>{const before=encodeProject(e.document);assert.equal(operation(),true);const after=encodeProject(e.document);assert.notEqual(after,before);assert.equal(e.undo(),true);assert.equal(encodeProject(e.document),before);assert.equal(e.redo(),true);assert.equal(encodeProject(e.document),after);return after;};
test('eight blend modes use straight byte RGB; transparent backdrop cannot darken source',()=>{
 const expected={normal:[192,64,128],multiply:[48,32,96],screen:[208,160,224],overlay:[96,65,192],darken:[64,64,128],lighten:[192,128,192],difference:[128,64,64],exclusion:[160,128,127]};
 const e=fixture(),raw=e.document.layers.map(l=>l.cels['frame-1'].slice());
 for(const mode of BLEND_MODES){e.setLayerBlendMode(mode);const p=composite(e.document);assert.deepEqual([...p.slice(0,3)],expected[mode],mode);assert.deepEqual([...p.slice(4)],[200,100,50,128]);for(let i=0;i<2;i++)assert.deepEqual(e.document.layers[i].cels['frame-1'],raw[i]);}
});
test('partial alpha, hidden layers and isolated nested group opacity apply once',()=>{
 const e=fixture();e.setLayerBlendMode('multiply');e.setLayerOpacity(128);assert.deepEqual([...composite(e.document).slice(0,4)],[56,80,144,255]);e.createGroup();e.createGroup('group-1');e.setGroupProperties('group-1',{opacity:128});e.setGroupProperties('group-2',{opacity:128});
 // First child in its own isolated group blends with transparent black, then the group composites normally.
 assert.deepEqual([...composite(e.document).slice(0,4)],[80,120,184,255]);e.toggleLayer();assert.deepEqual([...composite(e.document).slice(0,4)],[64,128,192,255]);
});
test('v11 exact roundtrip, v1-v10 defaults and hostile blend metadata rejection',()=>{
 const e=fixture();atomic(e,()=>e.setLayerBlendMode('screen'));const data=JSON.parse(encodeProject(e.document));assert.equal(data.version,16);assert.equal(encodeProject(decodeProject(JSON.stringify(data))),JSON.stringify(data));
 for(const version of [9,10]){const old=structuredClone(data);old.version=version;for(const l of old.layers)delete l.blendMode;assert.ok(decodeProject(JSON.stringify(old)).layers.every(l=>l.blendMode==='normal'));}
 for(const value of [undefined,null,0,'unknown',{},['normal']]){const bad=structuredClone(data);bad.layers[0].blendMode=value;assert.throws(()=>decodeProject(JSON.stringify(bad)),/blend/);}
 const before=encodeProject(e.document);assert.throws(()=>e.setLayerBlendMode('unknown'));assert.equal(encodeProject(e.document),before);assert.equal(e.setLayerBlendMode('screen'),false);
});
test('blends survive duplication, geometry, staged pixel effects and history; merge cannot silently change backdrop',()=>{
 const e=fixture();e.setLayerBlendMode('screen');const before=encodeProject(e.document);e.addLayer(true);assert.equal(e.document.layers.at(-1).blendMode,'screen');assert.throws(()=>e.mergeDown(),/Normal/);e.undo();assert.equal(encodeProject(e.document),before);
 e.applyStudio(prepareStudio(e.document,{...defaultStudioOptions(e.document,'offset'),points:[{x:1,y:0}],layers:['layer-2']}));assert.equal(e.document.layers[1].blendMode,'screen');e.undo();assert.equal(encodeProject(e.document),before);
 e.applyCanvasGeometry(prepareCanvasGeometry(e.document,{kind:'flip',axis:'horizontal'}));assert.equal(e.document.layers[1].blendMode,'screen');e.undo();assert.equal(encodeProject(e.document),before);
});
test('native subset rejects blend loss; explicit flattened PSD and ORA preserve appearance',async()=>{
 const e=fixture();e.setLayerBlendMode('exclusion');const before=encodeProject(e.document),pixels=composite(e.document);
 assert.throws(()=>encodeAseprite(e.document),/blends/);await assert.rejects(encodePiskel(e.document),/blends/);assert.throws(()=>encodePsd(e.document),/blend export/);await assert.rejects(encodeOra(e.document),/blend export/);
 const psd=encodePsd(e.document,'frames-as-layers'),ora=await encodeOra(e.document,'frames-as-layers');assert.ok(psd.warnings.some(w=>w.includes('flattened')));assert.ok(ora.warnings.some(w=>w.includes('flattened')));
 // Static stack contains the selected animation as layers; inspect each raw baked frame.
 assert.deepEqual(decodePsd(psd.bytes).document.layers[0].pixels,pixels);assert.deepEqual((await decodeOra(ora.bytes)).document.layers[0].pixels,pixels);assert.equal(encodeProject(e.document),before);
});
test('batch property changes are atomic, exact, no-op aware and independent of the paint target',()=>{
 const e=fixture(),active=e.document.activeLayerId;atomic(e,()=>e.setLayersProperties(['layer-1','layer-2'],{opacity:73,blendMode:'difference',locked:true,visible:false}));assert.equal(e.document.activeLayerId,active);assert.ok(e.document.layers.every(l=>l.opacity===73&&l.locked&&!l.visible&&l.blendMode==='difference'));assert.equal(e.setLayersProperties(['layer-2'],{opacity:73}),false);
 const saved=encodeProject(e.document);for(const ids of [[],['missing'],['layer-1','layer-1']])assert.throws(()=>e.setLayersProperties(ids,{opacity:128}));for(const patch of [{opacity:NaN},{opacity:256},{opacity:-1},{opacity:1.5},{locked:0},{visible:null},{blendMode:'wat'},{name:'no'},{opacity:undefined}])assert.throws(()=>e.setLayersProperties(['layer-1'],patch));assert.equal(encodeProject(e.document),saved);
});
test('batch duplication preserves per-layer links, hidden RGB, metadata and independence with one undo',()=>{
 const e=fixture();e.setLayerBlendMode('multiply');e.toggleLayerLock();e.toggleLayer();atomic(e,()=>e.duplicateLayers(['layer-2','layer-1']));const d=e.document;assert.deepEqual(d.layers.map(l=>l.id),['layer-1','layer-3','layer-2','layer-4']);for(const [original,copy] of [[d.layers[0],d.layers[1]],[d.layers[2],d.layers[3]]]){assert.equal(copy.cels['frame-1']===copy.cels['frame-2'],original.cels['frame-1']===original.cels['frame-2']);assert.notEqual(copy.cels['frame-1'],original.cels['frame-1']);assert.deepEqual(copy.cels['frame-1'],original.cels['frame-1']);for(const key of ['visible','locked','opacity','blendMode','groupId'])assert.equal(copy[key],original[key]);}
});
test('batch group and sibling block moves preserve order, parent contiguity and single undo',()=>{
 const e=fixture();e.addLayer();e.addLayer();atomic(e,()=>e.groupLayers(['layer-2','layer-1']));assert.deepEqual(e.document.layers.slice(0,2).map(l=>l.groupId),['group-1','group-1']);atomic(e,()=>e.moveLayers(['layer-3','layer-4'],-1));assert.deepEqual(e.document.layers.map(l=>l.id),['layer-3','layer-4','layer-1','layer-2']);assert.equal(e.moveLayers(['layer-3','layer-4'],-1),false);const before=encodeProject(e.document);assert.throws(()=>e.moveLayers(['layer-1','layer-3'],1),/sibling/);assert.throws(()=>e.groupLayers(['layer-3','layer-1']),/contiguous/);assert.equal(encodeProject(e.document),before);
});
test('noncontiguous checked leaves move one sibling per run without reversing checked order',()=>{
 const e=fixture();e.addLayer();e.addLayer();atomic(e,()=>e.moveLayers(['layer-1','layer-3'],1));assert.deepEqual(e.document.layers.map(l=>l.id),['layer-2','layer-1','layer-4','layer-3']);atomic(e,()=>e.moveLayers(['layer-1','layer-3'],-1));assert.deepEqual(e.document.layers.map(l=>l.id),['layer-1','layer-2','layer-3','layer-4']);
});
test('batch deletion prunes empty nested groups but preserves surviving ancestors and active target',()=>{
 const e=fixture();e.createGroup();e.createGroup('group-1');e.addLayer();e.moveIntoGroup('layer-3',null);e.selectLayer('layer-2');atomic(e,()=>e.deleteLayers(['layer-2']));assert.equal(e.document.groups.length,0);assert.deepEqual(e.document.layers.map(l=>l.id),['layer-1','layer-3']);assert.equal(e.document.activeLayerId,'layer-3');const before=encodeProject(e.document);assert.throws(()=>e.deleteLayers(['layer-1','layer-3']),/at least/);assert.equal(encodeProject(e.document),before);
});
test('batch duplication and deeper grouping preflight limits without partial mutation or undo records',()=>{
 const e=new PixelEditor(createDocument(256,256));for(let i=1;i<16;i++)e.addLayer();const before=encodeProject(e.document),bytes=e.historyBytes;assert.throws(()=>e.duplicateLayers(['layer-1','layer-2']));assert.equal(encodeProject(e.document),before);assert.equal(e.historyBytes,bytes);
 const g=fixture();g.createGroup();g.createGroup('group-1');g.createGroup('group-2');g.createGroup('group-3');const saved=encodeProject(g.document);assert.throws(()=>g.groupLayers(['layer-2']),/four/);assert.equal(encodeProject(g.document),saved);
});

test('removing an isolated group cannot silently rebind a blend to the outer backdrop',()=>{
 const e=fixture();e.setLayerBlendMode('multiply');e.createGroup();const before=encodeProject(e.document);assert.throws(()=>e.ungroup('group-1'),/isolation/);assert.equal(encodeProject(e.document),before);
});
test('legacy v10 clip libraries stay readable and v11 clips reject live blend metadata',()=>{
 const e=fixture(),current=JSON.parse(captureClip(e.document).text),old=structuredClone(current);old.project.version=10;delete old.project.layers[0].blendMode;
 assert.deepEqual(composite(decodeClip(JSON.stringify(old))),composite(decodeClip(JSON.stringify(current))));current.project.layers[0].blendMode='multiply';assert.throws(()=>decodeClip(JSON.stringify(current)),/Unsupported clip/);
});
test('blend and batch metadata changes invalidate previously prepared artwork plans',()=>{
 const e=fixture(),plan=prepareStudio(e.document,{...defaultStudioOptions(e.document,'offset'),points:[{x:1,y:0}]});e.setLayersProperties(['layer-1','layer-2'],{blendMode:'screen'});const before=encodeProject(e.document);assert.throws(()=>e.applyStudio(plan),/changed/);assert.equal(encodeProject(e.document),before);
});
